"""Compile/link the shipped GLSL using ANGLE GLES, without a browser or GPU.

ANGLE_LIB_DIR must contain libEGL.so, libGLESv2.so and SwiftShader's Vulkan ICD.
Input: JSON array of alternating vertex/fragment shader sources on stdin.
"""
import ctypes as c
import json
import os
from pathlib import Path
import sys

root = Path(os.environ['ANGLE_LIB_DIR']).resolve()
os.environ['VK_ICD_FILENAMES'] = str(root / 'vk_swiftshader_icd.json')
egl_lib = c.CDLL(str(root / 'libEGL.so'), mode=c.RTLD_GLOBAL)
P, I, U = c.c_void_p, c.c_int, c.c_uint

def egl(name, result, args):
    f = getattr(egl_lib, name)
    f.restype, f.argtypes = result, args
    return f

proc = egl('eglGetProcAddress', P, [c.c_char_p])
platform = c.CFUNCTYPE(P, U, P, c.POINTER(I))(proc(b'eglGetPlatformDisplayEXT'))
display = platform(0x3202, None, (I*5)(0x3203, 0x3450, 0x3209, 0x3487, 0x3038))
major, minor = I(), I()
assert egl('eglInitialize', U, [P, c.POINTER(I), c.POINTER(I)])(display, c.byref(major), c.byref(minor)), 'EGL initialization failed'
assert egl('eglBindAPI', U, [U])(0x30A0)
config, count = P(), I()
attrs = (I*11)(0x3033, 1, 0x3040, 0x40, 0x3024, 8, 0x3023, 8, 0x3022, 8, 0x3038)
assert egl('eglChooseConfig', U, [P,c.POINTER(I),c.POINTER(P),I,c.POINTER(I)])(display,attrs,c.byref(config),1,c.byref(count)) and count.value
context = egl('eglCreateContext', P, [P,P,P,c.POINTER(I)])(display,config,None,(I*3)(0x3098,3,0x3038))
surface = egl('eglCreatePbufferSurface', P, [P,P,c.POINTER(I)])(display,config,(I*5)(0x3057,1,0x3056,1,0x3038))
assert context and surface
assert egl('eglMakeCurrent', U, [P,P,P,P])(display,surface,surface,context)

def gl(name, result, args):
    return c.CFUNCTYPE(result, *args)(proc(name.encode()))

create_shader = gl('glCreateShader', U, [U])
shader_source = gl('glShaderSource', None, [U,I,c.POINTER(c.c_char_p),c.POINTER(I)])
compile_shader = gl('glCompileShader', None, [U])
get_shader = gl('glGetShaderiv', None, [U,U,c.POINTER(I)])
shader_log = gl('glGetShaderInfoLog', None, [U,I,c.POINTER(I),P])
create_program = gl('glCreateProgram', U, [])
attach = gl('glAttachShader', None, [U,U])
link = gl('glLinkProgram', None, [U])
get_program = gl('glGetProgramiv', None, [U,U,c.POINTER(I)])
program_log = gl('glGetProgramInfoLog', None, [U,I,c.POINTER(I),P])
delete_shader = gl('glDeleteShader', None, [U])
delete_program = gl('glDeleteProgram', None, [U])

sources = json.load(sys.stdin)
assert sources and len(sources) % 2 == 0
failures, programs = [], []
names = ['sky','ground','grass','objects','camera effects','shadows']
for pair in range(len(sources)//2):
    program = create_program()
    shaders = []
    errors = []
    name = names[pair] if pair < len(names) else str(pair)
    for stage in range(2):
        shader = create_shader(0x8B31 if stage == 0 else 0x8B30)
        shaders.append(shader)
        source = c.c_char_p(sources[pair*2+stage].encode())
        shader_source(shader, 1, c.byref(source), None)
        compile_shader(shader)
        ok = I(); get_shader(shader, 0x8B81, c.byref(ok))
        if not ok.value:
            info = c.create_string_buffer(16384)
            shader_log(shader, len(info), None, info)
            errors.append(f'{name} {"vertex" if stage == 0 else "fragment"}: {info.value.decode()}')
        attach(program, shader)
    if not errors:
        link(program)
        ok = I(); get_program(program, 0x8B82, c.byref(ok))
        if not ok.value:
            info = c.create_string_buffer(16384)
            program_log(program, len(info), None, info)
            errors.append(f'{name} link: {info.value.decode()}')
    failures.extend(errors)
    programs.append({'name':name, 'linked':not errors})
    for shader in shaders: delete_shader(shader)
    delete_program(program)

renderer = gl('glGetString', c.c_char_p, [U])(0x1F01).decode()
egl('eglMakeCurrent', U, [P,P,P,P])(display,None,None,None)
egl('eglDestroySurface', U, [P,P])(display,surface)
egl('eglDestroyContext', U, [P,P])(display,context)
egl('eglTerminate', U, [P])(display)
print(json.dumps({'renderer':renderer, 'programs':programs, 'failures':failures}))
sys.exit(bool(failures))

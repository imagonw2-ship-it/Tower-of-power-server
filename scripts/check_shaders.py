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
    if not errors and pair == 4:
        # Exercise the actual post shader, including the WebGL2 depth attachment.
        # A 1px fixture is enough to catch sampler/occlusion/flash regressions.
        gen_texture = gl('glGenTextures', None, [I,c.POINTER(U)])
        bind_texture = gl('glBindTexture', None, [U,U])
        active_texture = gl('glActiveTexture', None, [U])
        tex_parameter = gl('glTexParameteri', None, [U,U,I])
        tex_image = gl('glTexImage2D', None, [U,I,I,I,I,I,U,U,P])
        color_tex, depth_tex, fb = U(), U(), U()
        for unit, handle, depth in [(0,color_tex,False),(1,depth_tex,True)]:
            active_texture(0x84C0+unit);gen_texture(1,c.byref(handle));bind_texture(0x0DE1,handle)
            for key in [0x2800,0x2801]:tex_parameter(0x0DE1,key,0x2600)
            for key in [0x2802,0x2803]:tex_parameter(0x0DE1,key,0x812F)
            pixel=(U*1)(int(.9*0xffffffff)) if depth else (c.c_ubyte*4)(255,255,255,255)
            tex_image(0x0DE1,0,0x81A6 if depth else 0x8058,1,1,0,0x1902 if depth else 0x1908,0x1405 if depth else 0x1401,pixel)
        gl('glGenFramebuffers',None,[I,c.POINTER(U)])(1,c.byref(fb))
        bind_fb=gl('glBindFramebuffer',None,[U,U]);bind_fb(0x8D40,fb)
        attach_tex=gl('glFramebufferTexture2D',None,[U,U,U,U,I])
        attach_tex(0x8D40,0x8CE0,0x0DE1,color_tex,0);attach_tex(0x8D40,0x8D00,0x0DE1,depth_tex,0)
        assert gl('glCheckFramebufferStatus',U,[U])(0x8D40)==0x8CD5,'Scene depth texture framebuffer incomplete'
        bind_fb(0x8D40,0)
        gl('glUseProgram',None,[U])(program)
        location=gl('glGetUniformLocation',I,[U,c.c_char_p])
        ui=gl('glUniform1i',None,[I,I]);uf=gl('glUniform1f',None,[I,c.c_float])
        ui(location(program,b'u_scene'),0);ui(location(program,b'u_sceneDepth'),1)
        gl('glUniform2f',None,[I,c.c_float,c.c_float])(location(program,b'u_texel'),1,1)
        gl('glUniform4fv',None,[I,I,c.POINTER(c.c_float)])(location(program,b'u_censorRects[0]'),1,(c.c_float*4)(.2,.2,.8,.8))
        uf(location(program,b'u_censorDepths[0]'),.6)
        gl('glViewport',None,[I,I,I,I])(0,0,1,1)
        for count,depth,flash,redacted in [(1,.9,0,True),(1,.3,0,False),(0,.9,0,False),(1,.9,1,True)]:
            ui(location(program,b'u_censorCount'),count);uf(location(program,b'u_flash'),flash)
            active_texture(0x84C1);bind_texture(0x0DE1,depth_tex)
            tex_image(0x0DE1,0,0x81A6,1,1,0,0x1902,0x1405,(U*1)(int(depth*0xffffffff)))
            gl('glDrawArrays',None,[U,I,I])(0x0004,0,3)
            pixel=(c.c_ubyte*4)();gl('glReadPixels',None,[I,I,I,I,U,U,P])(0,0,1,1,0x1908,0x1401,pixel)
            assert (max(pixel[:3])==0)==redacted, f'Head censor pixel check failed: {count,depth,flash,list(pixel)}'
        assert gl('glGetError',U,[])()==0,'Graphics error during censor pixel checks'
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

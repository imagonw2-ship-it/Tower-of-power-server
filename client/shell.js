function syncSettingsReadouts(){
  for(const output of document.querySelectorAll('.settingRange output'))output.textContent=Math.round(Number(document.getElementById(output.getAttribute('for')).value)*100)+'%';
}
const uiPageAnimations=new WeakMap(),uiCommandAnimations=new WeakMap();
function selectUiPage(button,tabAttribute,pageAttribute){
  const value=button.getAttribute(tabAttribute),tabs=[...document.querySelectorAll(`[${tabAttribute}]`)];
  const previous=tabs.find(tab=>tab.getAttribute('aria-pressed')==='true');
  for(const tab of tabs)tab.setAttribute('aria-pressed',String(tab===button));
  const index=tabs.filter(tab=>!tab.hidden).indexOf(button);
  button.parentElement.style.setProperty('--tab-index',String(Math.max(0,index)));
  for(const page of document.querySelectorAll(`[${pageAttribute}]`)){
    uiPageAnimations.get(page)?.cancel();
    page.hidden=page.getAttribute(pageAttribute)!==value;
    if(!page.hidden&&previous!==button&&!reducedMotion&&page.animate){
      const animation=page.animate([{opacity:0,transform:'translateX(8px)'},{opacity:1,transform:'translateX(0)'}],{duration:280,easing:'cubic-bezier(.22,1,.36,1)'});
      uiPageAnimations.set(page,animation);
    }
  }
}
for(const tab of document.querySelectorAll('[data-settings-tab]'))tab.addEventListener('click',()=>{
  selectUiPage(tab,'data-settings-tab','data-settings-page');
  document.querySelector('.settingsContent').scrollTop=0;syncSettingsReadouts();
});
for(const input of document.querySelectorAll('.settingRange input'))input.addEventListener('input',syncSettingsReadouts);
// Brief feedback for commands, including dynamically populated player controls.
document.getElementById('fieldPanel').addEventListener('click',event=>{
  const button=event.target.closest('button');
  if(!button||button.disabled||button.hasAttribute('data-tablet-tab')||button.id==='fieldBack'||reducedMotion||!button.animate)return;
  uiCommandAnimations.get(button)?.cancel();
  uiCommandAnimations.set(button,button.animate([{boxShadow:'inset 0 0 0 1px #ffffff00'},{boxShadow:'inset 0 0 0 1px #ffffffb0',offset:.25},{boxShadow:'inset 0 0 0 1px #ffffff00'}],{duration:430,easing:'ease-out'}));
});

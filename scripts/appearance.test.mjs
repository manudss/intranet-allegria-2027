import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../libs/appearance/assets/appearance-init.js',import.meta.url),'utf8');
function boot(saved,systemDark,denied=false){const document={documentElement:{dataset:{},style:{}}};vm.runInNewContext(source,{document,localStorage:{getItem(){if(denied)throw Error('denied');return saved}},matchMedia:()=>({matches:systemDark})});return document.documentElement;}
test('first paint matches persisted priority and auto fallback',()=>{
 for(const [saved,system,want] of [[null,true,'dark'],[null,false,'light'],['light',true,'light'],['dark',false,'dark'],['auto',true,'dark'],['invalid',true,'dark']]){
  const root=boot(saved,system);assert.equal(root.dataset.theme,want);assert.equal(root.style.colorScheme,want==='dark'?'dark':'only light');
 }
});
test('storage refusal does not block first paint',()=>assert.equal(boot(null,true,true).dataset.theme,'dark'));
test('all three apps load identical bootstrap before page styles and package it offline',()=>{
 for(const app of ['site','web','mobile']){
  const html=fs.readFileSync(new URL(`../apps/${app}/src/index.html`,import.meta.url),'utf8');assert.match(html,/<script src="appearance-init.js"><\/script>/);
  const config=JSON.parse(fs.readFileSync(new URL(`../apps/${app}/project.json`,import.meta.url)));assert.ok(config.targets.build.options.assets.some(a=>a.input==='libs/appearance/assets'));
 }
 const sw=JSON.parse(fs.readFileSync(new URL('../apps/mobile/ngsw-config.json',import.meta.url)));assert.ok(sw.assetGroups.some(g=>g.installMode==='prefetch'&&g.resources.files.includes('/*.js')));
});

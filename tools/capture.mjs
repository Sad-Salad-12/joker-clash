// Run the site on localhost:8765, then run this module through ego-browser nodejs.
// Captures real UI interactions; no hand, score, or HP is injected.
const {fileURLToPath} = await import('node:url');
const {dirname,resolve} = await import('node:path');
const fs = await import('node:fs/promises');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const frames=resolve(root,'.capture');
await fs.mkdir(frames,{recursive:true});
const task=await taskSpace('Joker Clash visual refinement');
const page=task.page('p1');
await page.goto('http://127.0.0.1:8765/');
await page.cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
await page.evaluate(()=>document.fonts.ready);
await page.evaluate(()=>Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{}))));
await page.evaluate(()=>{if(document.querySelector('#btnSound').getAttribute('aria-pressed')==='true')document.querySelector('#btnSound').click();});
await page.mouse.move(1430,890);
const checks=[];
let nextAction=2;
const fps=12,duration=36,start=Date.now();
for(let i=0;i<fps*duration;i++){
  const seconds=i/fps;
  if(seconds>=nextAction){
    checks.push(await page.evaluate(()=>{
      const click=id=>document.getElementById(id).click();
      if(!document.querySelector('#startScreen').classList.contains('hidden')){click('btnStart');return 'Started a normal match';}
      if(!document.querySelector('#jokerScreen').classList.contains('hidden')){const b=document.querySelector('#jokerChoices button');const name=b.innerText;b.click();return 'Drafted '+name;}
      if(!document.querySelector('#endScreen').classList.contains('hidden'))return 'Match finished';
      if(!document.querySelector('#btnPlay').disabled){click('btnPlay');return 'Played selected hand';}
      if(!document.querySelector('#btnHint').disabled){click('btnHint');return 'Selected '+document.querySelector('#handTypeName').textContent;}
      return 'Opponent or animation in progress';
    }));
    nextAction+=2;
  }
  const shot=await page.cdp('Page.captureScreenshot',{format:'jpeg',quality:80,captureBeyondViewport:false});
  await fs.writeFile(resolve(frames,String(i).padStart(5,'0')+'.jpg'),Buffer.from(shot.data,'base64'));
  const wait=start+(i+1)*1000/fps-Date.now();if(wait>0)await new Promise(r=>setTimeout(r,wait));
}
console.log({frames:fps*duration,fps,duration,actions:checks,final:await page.evaluate(()=>({round:window.__JOKER_CLASH__.getState()?.round,playerHP:window.__JOKER_CLASH__.getState()?.me.hp,opponentHP:window.__JOKER_CLASH__.getState()?.opp.hp}))});
// Caller retains the same task space for further review and closes it at completion.

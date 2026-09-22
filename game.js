import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

let mode='br',scene,camera,renderer,clock,player,bots=[],loot=[],keys={},ammo=30,score=0,health=100,running=false,zoneRadius=105;
const $=s=>document.querySelector(s);

document.querySelectorAll('.mode').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.mode').forEach(x=>x.classList.remove('active'));
  b.classList.add('active'); mode=b.dataset.mode;
});
$('#play').onclick=()=>start();
onkeydown=e=>keys[e.code]=1;
onkeyup=e=>keys[e.code]=0;

function start(){
  document.querySelector('#menu').classList.add('hidden');
  document.querySelector('#hud').classList.remove('hidden');
  running=true; ammo=30; score=0; health=100; zoneRadius=105;
  $('#ammo').textContent=ammo; $('#score').textContent='SCORE 0';
  $('#modeText').textContent=mode==='br'?'BATTLE ROYALE':'5V5';
  $('#aliveText').textContent='ALIVE '+(mode==='br'?20:10);
  init(); msg('MATCH STARTED');
}

function init(){
  if(renderer) renderer.domElement.remove();
  scene=new THREE.Scene();
  scene.background=new THREE.Color(0x111827);
  camera=new THREE.PerspectiveCamera(68,innerWidth/innerHeight,.1,300);
  renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(1);
  renderer.setSize(innerWidth,innerHeight);
  document.body.appendChild(renderer.domElement);
  clock=new THREE.Clock();

  scene.add(new THREE.HemisphereLight(0xd9e8ff,0x263522,1.5));
  const sun=new THREE.DirectionalLight(0xffffff,1.5);
  sun.position.set(30,50,20); scene.add(sun);

  const ground=new THREE.Mesh(
    new THREE.PlaneGeometry(180,180),
    new THREE.MeshLambertMaterial({color:0x26362b})
  );
  ground.rotation.x=-Math.PI/2; scene.add(ground);

  // Lightweight cover objects
  for(let i=0;i<22;i++){
    const s=1.5+Math.random()*2.5,h=1.5+Math.random()*3;
    const o=new THREE.Mesh(
      new THREE.BoxGeometry(s,h,s),
      new THREE.MeshLambertMaterial({color:0x465568})
    );
    o.position.set((Math.random()-.5)*140,h/2,(Math.random()-.5)*140);
    scene.add(o);
  }

  // Player
  player=new THREE.Group();
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(.45,.95,3,6),new THREE.MeshLambertMaterial({color:0x2388ff}));
  body.position.y=1; player.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.35,8,6),new THREE.MeshLambertMaterial({color:0xe1aa83}));
  head.position.y=1.75; player.add(head);
  const gun=new THREE.Mesh(new THREE.BoxGeometry(.14,.14,1),new THREE.MeshLambertMaterial({color:0x17191f}));
  gun.position.set(.45,1.2,-.45); player.add(gun);
  player.position.set(0,0,12); scene.add(player);

  bots=[];
  const n=mode==='5v5'?9:19;
  for(let i=0;i<n;i++) spawnBot(i<Math.ceil(n/2));

  // Loot pickups
  loot=[];
  for(let i=0;i<10;i++) spawnLoot();

  // Safe-zone ring
  const ring=new THREE.Mesh(
    new THREE.RingGeometry(zoneRadius-.35,zoneRadius,.96),
    new THREE.MeshBasicMaterial({color:0x31a8ff,side:THREE.DoubleSide})
  );
  ring.rotation.x=-Math.PI/2; ring.name='zoneRing'; scene.add(ring);

  camera.position.set(0,4,19);
  camera.lookAt(player.position);
  renderer.domElement.onmousedown=e=>{if(e.button===0)shoot()};
  onresize=resize;
  requestAnimationFrame(loop);
}

function spawnBot(team){
  const g=new THREE.Group();
  const b=new THREE.Mesh(new THREE.CapsuleGeometry(.42,.9,3,6),new THREE.MeshLambertMaterial({color:team?0xe84b5d:0xf0c84b}));
  b.position.y=1; g.add(b);
  const h=new THREE.Mesh(new THREE.SphereGeometry(.32,8,6),new THREE.MeshLambertMaterial({color:0xc58e70}));
  h.position.y=1.7; g.add(h);
  g.position.set((Math.random()-.5)*120,0,(Math.random()-.5)*120);
  g.userData={alive:true,speed:1.2+Math.random()*1.2,team};
  scene.add(g); bots.push(g);
}

function spawnLoot(){
  const p=new THREE.Mesh(new THREE.BoxGeometry(.5,.5,.5),new THREE.MeshBasicMaterial({color:0x22d3a5}));
  p.position.set((Math.random()-.5)*130,.35,(Math.random()-.5)*130);
  p.userData={type:'ammo'}; scene.add(p); loot.push(p);
}

function shoot(){
  if(!running||ammo<=0)return;
  ammo--; $('#ammo').textContent=ammo;
  const dir=new THREE.Vector3(0,0,-1).applyQuaternion(player.quaternion).normalize();
  const ray=new THREE.Raycaster(player.position.clone().add(new THREE.Vector3(0,1,0)),dir,0,70);
  const hits=ray.intersectObjects(bots,true);
  if(hits.length){
    let g=hits[0].object;
    while(g.parent && !g.userData.alive) g=g.parent;
    if(g.userData.alive){
      g.userData.alive=false; scene.remove(g); score++;
      $('#score').textContent='SCORE '+score;
      const alive=bots.filter(b=>b.userData.alive).length+1;
      $('#aliveText').textContent='ALIVE '+alive;
      msg('ELIMINATION');
    }
  }
}

function takeDamage(amount){
  health=Math.max(0,health-amount);
  const el=$('#health'); if(el) el.textContent='HP '+health;
  if(health<=0){running=false;msg('ELIMINATED');setTimeout(()=>location.reload(),1200)}
}

function loop(){
  if(!running)return;
  const dt=Math.min(clock.getDelta(),.05);
  const x=(keys.KeyD?1:0)-(keys.KeyA?1:0);
  const z=(keys.KeyS?1:0)-(keys.KeyW?1:0);

  if(x||z){
    const v=new THREE.Vector3(x,0,z).normalize();
    player.position.addScaledVector(v,(keys.ShiftLeft?8:4.5)*dt);
    player.rotation.y=Math.atan2(v.x,v.z);
  }

  player.position.x=THREE.MathUtils.clamp(player.position.x,-85,85);
  player.position.z=THREE.MathUtils.clamp(player.position.z,-85,85);

  // Bots chase only when nearby
  for(const b of bots){
    if(!b.userData.alive)continue;
    const dist=b.position.distanceTo(player.position);
    if(dist<32){
      const d=player.position.clone().sub(b.position).setY(0).normalize();
      b.position.addScaledVector(d,b.userData.speed*dt);
      b.lookAt(player.position.x,b.position.y,player.position.z);
      if(dist<2.2 && Math.random()<dt*.45) takeDamage(5);
    }
  }

  // Collect ammo
  for(let i=loot.length-1;i>=0;i--){
    const p=loot[i];
    p.rotation.y+=dt*2;
    if(p.position.distanceTo(player.position)<1.5){
      ammo=Math.min(60,ammo+10); $('#ammo').textContent=ammo;
      scene.remove(p); loot.splice(i,1); msg('+10 AMMO');
    }
  }

  // Shrinking zone
  zoneRadius=Math.max(25,zoneRadius-dt*.45);
  const ring=scene.getObjectByName('zoneRing');
  if(ring) ring.scale.set(zoneRadius/105,zoneRadius/105,zoneRadius/105);
  if(Math.hypot(player.position.x,player.position.z)>zoneRadius && Math.random()<dt*.8) takeDamage(2);

  camera.position.lerp(new THREE.Vector3(player.position.x,4.2,player.position.z+7),.12);
  camera.lookAt(player.position.x,1.2,player.position.z-8);
  renderer.render(scene,camera);
  requestAnimationFrame(loop);
}

function resize(){
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
}
function msg(t){
  const el=$('#msg'); if(!el)return;
  el.textContent=t; setTimeout(()=>{if(el.textContent===t)el.textContent=''},1000);
}

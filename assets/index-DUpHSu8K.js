import{$ as e,$t as t,A as n,B as r,Bt as i,C as a,F as o,G as s,Gt as c,H as l,Ht as u,J as d,Jt as f,K as p,Kt as m,L as h,Mt as g,N as _,Nt as v,O as y,Q as b,Qt as x,Rt as S,S as C,U as w,Ut as T,V as E,Vt as D,W as O,Wt as ee,_ as k,a as te,at as A,b as j,c as M,ct as N,d as ne,dt as P,en as re,et as ie,f as ae,g as oe,gt as se,i as ce,it as le,j as F,k as ue,l as de,lt as fe,m as pe,n as me,nt as he,o as ge,ot as _e,p as ve,q as I,qt as ye,r as be,s as xe,st as Se,t as Ce,tt as we,u as Te,ut as Ee,x as L,y as R,z as De,zt as Oe}from"./post-DxR2avLD.js";import{i as ke,n as Ae,r as je,t as Me}from"./three-BKfuGixh.js";var Ne=Object.create,Pe=Object.defineProperty,Fe=Object.getOwnPropertyDescriptor,Ie=Object.getOwnPropertyNames,Le=Object.getPrototypeOf,Re=Object.prototype.hasOwnProperty,ze=(e,t)=>()=>(t||(e((t={exports:{}}).exports,t),e=null),t.exports),Be=(e,t,n,r)=>{if(t&&typeof t==`object`||typeof t==`function`)for(var i=Ie(t),a=0,o=i.length,s;a<o;a++)s=i[a],!Re.call(e,s)&&s!==n&&Pe(e,s,{get:(e=>t[e]).bind(null,s),enumerable:!(r=Fe(t,s))||r.enumerable});return e},Ve=(e,t,n)=>(n=e==null?{}:Ne(Le(e)),Be(t||!e||!e.__esModule||!Re.call(e,`default`)?Pe(n,`default`,{value:e,enumerable:!0}):n,e));(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var He={KeyW:`throttleUp`,ArrowUp:`throttleUp`,KeyS:`throttleDown`,ArrowDown:`throttleDown`,KeyA:`rudderLeft`,ArrowLeft:`rudderLeft`,KeyD:`rudderRight`,ArrowRight:`rudderRight`,ShiftLeft:`boost`,ShiftRight:`boost`,Space:`anchor`,KeyC:`cameraMode`,KeyJ:`journal`,Escape:`settings`,Backquote:`debug`,KeyR:`reel`},Ue=class{held=new Set;pressed=new Set;released=new Set;pointerX=0;pointerY=0;pointerDeltaX=0;pointerDeltaY=0;primaryDown=!1;primaryPressed=!1;primaryReleased=!1;secondaryDown=!1;wheel=0;pointerLocked=!1;element;disposers=[];constructor(e){this.element=e,this.bind(window,`keydown`,this.onKeyDown),this.bind(window,`keyup`,this.onKeyUp),this.bind(window,`blur`,this.onBlur),this.bind(e,`pointerdown`,this.onPointerDown),this.bind(window,`pointerup`,this.onPointerUp),this.bind(window,`pointermove`,this.onPointerMove),this.bind(e,`wheel`,this.onWheel,{passive:!0}),this.bind(e,`contextmenu`,this.onContextMenu),this.bind(document,`pointerlockchange`,this.onPointerLockChange)}isHeld(e){return this.held.has(e)}wasPressed(e){return this.pressed.has(e)}wasReleased(e){return this.released.has(e)}get throttleAxis(){return!!this.isHeld(`throttleUp`)-+!!this.isHeld(`throttleDown`)}get rudderAxis(){return!!this.isHeld(`rudderRight`)-+!!this.isHeld(`rudderLeft`)}requestPointerLock(){this.pointerLocked||this.element.requestPointerLock()}exitPointerLock(){this.pointerLocked&&document.exitPointerLock()}endFrame(){this.pressed.clear(),this.released.clear(),this.primaryPressed=!1,this.primaryReleased=!1,this.pointerDeltaX=0,this.pointerDeltaY=0,this.wheel=0}dispose(){for(let e of this.disposers)e();this.disposers.length=0}bind(e,t,n,r){e.addEventListener(t,n,r),this.disposers.push(()=>e.removeEventListener(t,n,r))}onKeyDown=e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;let t=e.target;if(t instanceof HTMLInputElement||t instanceof HTMLSelectElement)return;let n=He[e.code];n!==void 0&&((e.code===`Space`||e.code.startsWith(`Arrow`))&&e.preventDefault(),!e.repeat&&(this.held.add(n),this.pressed.add(n)))};onKeyUp=e=>{let t=He[e.code];t!==void 0&&(this.held.delete(t),this.released.add(t))};onBlur=()=>{for(let e of this.held)this.released.add(e);this.held.clear(),this.primaryDown=!1,this.secondaryDown=!1};onPointerDown=e=>{e.button===0?(this.primaryDown=!0,this.primaryPressed=!0):e.button===2&&(this.secondaryDown=!0),this.updatePointer(e)};onPointerUp=e=>{e.button===0?(this.primaryDown=!1,this.primaryReleased=!0):e.button===2&&(this.secondaryDown=!1)};onPointerMove=e=>{this.updatePointer(e)};onWheel=e=>{this.wheel+=e.deltaY};onContextMenu=e=>{e.preventDefault()};onPointerLockChange=()=>{this.pointerLocked=document.pointerLockElement===this.element};updatePointer(e){if(this.pointerLocked)this.pointerDeltaX+=e.movementX,this.pointerDeltaY+=e.movementY;else{let t=this.element.getBoundingClientRect(),n=(e.clientX-t.left)/t.width*2-1,r=-((e.clientY-t.top)/t.height*2-1);this.pointerDeltaX+=(n-this.pointerX)*t.width*.5,this.pointerDeltaY+=(this.pointerY-r)*t.height*.5,this.pointerX=n,this.pointerY=r}}},We=1/120,Ge=6,Ke=.25,qe=class{fixedUpdate;render;simTime=0;elapsed=0;fps=60;frameMs=0;accumulator=0;lastTime=0;rafHandle=0;running=!1;fpsAccumulator=0;fpsFrames=0;constructor(e,t){this.fixedUpdate=e,this.render=t}start(){this.running||(this.running=!0,this.lastTime=performance.now(),this.tick(this.lastTime))}stop(){this.running=!1,this.rafHandle!==0&&(cancelAnimationFrame(this.rafHandle),this.rafHandle=0)}tick=e=>{if(!this.running)return;this.rafHandle=requestAnimationFrame(this.tick);let t=(e-this.lastTime)/1e3;this.lastTime=e;let n=Math.min(t,Ke);this.elapsed+=n,this.fpsAccumulator+=n,this.fpsFrames+=1,this.fpsAccumulator>=.5&&(this.fps=this.fpsFrames/this.fpsAccumulator,this.fpsAccumulator=0,this.fpsFrames=0),this.accumulator+=n;let r=0;for(;this.accumulator>=.008333333333333333&&r<Ge;)this.fixedUpdate(We,this.simTime),this.simTime+=We,this.accumulator-=We,r+=1;r===Ge&&(this.accumulator=0);let i=performance.now();this.render(n,this.accumulator/We),this.frameMs=performance.now()-i}},Je=[`_albedo`,`_diffuse`,`_color`,`_basecolor`],Ye=class{textures=new Map;hdris=new Map;tracked=new Set;listeners=new Set;textureLoader=new ee;hdrLoader=new ke;ktx2Loader;queued=0;completed=0;anisotropy=1;constructor(e){this.anisotropy=e.capabilities.getMaxAnisotropy(),this.ktx2Loader=new je().setTranscoderPath(`/endless-fishing/basis/`).detectSupport(e)}onProgress(e){return this.listeners.add(e),()=>this.listeners.delete(e)}track(e){return this.tracked.add(e),e}untrack(e){this.tracked.delete(e)}resolve(e){return/^(https?:)?\/\//.test(e)||e.startsWith(`data:`)?e:`/endless-fishing/${e.replace(/^\/+/,``)}`}loadTexture(e,t={}){let n=this.textures.get(e);if(n!==void 0)return n;let r=this.resolve(e),i=r.endsWith(`.ktx2`);this.begin(e);let a=(i?this.ktx2Loader.loadAsync(r):this.textureLoader.loadAsync(r)).then(n=>((t.srgb??Je.some(t=>e.toLowerCase().includes(t)))&&(n.colorSpace=S),t.repeat!==!1&&(n.wrapS=v,n.wrapT=v),n.anisotropy=this.anisotropy,i||(n.generateMipmaps=!0,n.minFilter=d,n.magFilter=I),n.needsUpdate=!0,this.tracked.add(n),this.end(e),n));return this.textures.set(e,a),a}loadHDRI(e){let t=this.hdris.get(e);if(t!==void 0)return t;this.begin(e);let n=this.hdrLoader.loadAsync(this.resolve(e)).then(t=>(t.minFilter=I,t.magFilter=I,t.generateMipmaps=!1,this.tracked.add(t),this.end(e),t));return this.hdris.set(e,n),n}async loadBinary(e){this.begin(e);let t=await fetch(this.resolve(e));if(!t.ok)throw this.end(e),Error(`Failed to load ${e}: ${t.status} ${t.statusText}`);let n=await t.arrayBuffer();return this.end(e),n}get progress(){return this.queued===0?1:this.completed/this.queued}dispose(){for(let e of this.tracked)e.dispose();this.tracked.clear(),this.textures.clear(),this.hdris.clear(),this.ktx2Loader.dispose(),this.listeners.clear()}begin(e){this.queued+=1,this.emit(e)}end(e){this.completed+=1,this.emit(e)}emit(e){for(let t of this.listeners)t(this.completed,this.queued,e)}},Xe={low:{preset:`low`,renderScale:.75,waveCount:5,oceanGridResolution:96,oceanRings:5,cloudSteps:14,cloudScale:.4,refractionScale:.35,shadowsEnabled:!1,shadowCascades:1,shadowMapSize:1024,ssaoEnabled:!1,bloomEnabled:!0,gradeEnabled:!0,dofEnabled:!1,godRaysEnabled:!1,motionBlurEnabled:!1,chromaticAberrationEnabled:!1,grainEnabled:!1,vignetteEnabled:!0,antialias:`none`,drawDistance:2200,instanceDensity:.3,schoolSize:24,probeFacesPerFrame:1,probeResolution:64},medium:{preset:`medium`,renderScale:1,waveCount:6,oceanGridResolution:128,oceanRings:6,cloudSteps:24,cloudScale:.5,refractionScale:.5,shadowsEnabled:!0,shadowCascades:2,shadowMapSize:1024,ssaoEnabled:!1,bloomEnabled:!0,gradeEnabled:!0,dofEnabled:!1,godRaysEnabled:!0,motionBlurEnabled:!1,chromaticAberrationEnabled:!1,grainEnabled:!0,vignetteEnabled:!0,antialias:`smaa`,drawDistance:3600,instanceDensity:.55,schoolSize:40,probeFacesPerFrame:1,probeResolution:128},high:{preset:`high`,renderScale:1,waveCount:7,oceanGridResolution:160,oceanRings:7,cloudSteps:40,cloudScale:.6,refractionScale:.65,shadowsEnabled:!0,shadowCascades:3,shadowMapSize:2048,ssaoEnabled:!0,bloomEnabled:!0,gradeEnabled:!0,dofEnabled:!0,godRaysEnabled:!0,motionBlurEnabled:!0,chromaticAberrationEnabled:!1,grainEnabled:!0,vignetteEnabled:!0,antialias:`smaa`,drawDistance:5200,instanceDensity:.8,schoolSize:64,probeFacesPerFrame:2,probeResolution:128},ultra:{preset:`ultra`,renderScale:1,waveCount:8,oceanGridResolution:192,oceanRings:8,cloudSteps:64,cloudScale:.75,refractionScale:.85,shadowsEnabled:!0,shadowCascades:4,shadowMapSize:2048,ssaoEnabled:!0,bloomEnabled:!0,gradeEnabled:!0,dofEnabled:!0,godRaysEnabled:!0,motionBlurEnabled:!0,chromaticAberrationEnabled:!1,grainEnabled:!0,vignetteEnabled:!0,antialias:`smaa`,drawDistance:7e3,instanceDensity:1,schoolSize:96,probeFacesPerFrame:3,probeResolution:256}},Ze=`endless-fishing/settings/v2`,Qe=32.08,$e=34.78,et=class{graphics;world;audio;listeners=new Set;locationExplicit=!1;constructor(e){this.graphics={...Xe.high,anisotropy:e},this.world={timeScale:1,timeOverrideMs:null,latitudeDeg:Qe,longitudeDeg:$e,seed:1592652126,weatherOverride:null},this.audio={masterVolume:.8,musicVolume:.35,muted:!1},this.load()}setLocationIfUnset(e,t){this.locationExplicit||(this.world.latitudeDeg=e,this.world.longitudeDeg=t)}setLocation(e,t){this.world.latitudeDeg=e,this.world.longitudeDeg=t,this.locationExplicit=!0,this.emit(`world`)}applyPreset(e){Object.assign(this.graphics,Xe[e]),this.emit(`graphics`)}static previewPreset(e){return Xe[e]}onChange(e){return this.listeners.add(e),()=>this.listeners.delete(e)}emit(e){let t={graphics:this.graphics,world:this.world,audio:this.audio};for(let n of this.listeners)n(t,e);(e!==`world`||this.world.timeOverrideMs===null)&&this.save()}save(){try{let e={graphics:this.graphics,audio:this.audio,world:{latitudeDeg:this.world.latitudeDeg,longitudeDeg:this.world.longitudeDeg,seed:this.world.seed}};localStorage.setItem(Ze,JSON.stringify(e))}catch{}}load(){let e=null;try{e=localStorage.getItem(Ze)}catch{return}if(e!==null)try{let t=JSON.parse(e);if(t.graphics){let e=this.graphics.anisotropy;Object.assign(this.graphics,t.graphics,{anisotropy:e})}if(t.audio&&Object.assign(this.audio,t.audio),t.world){let{latitudeDeg:e,longitudeDeg:n,seed:r}=t.world;typeof e==`number`&&typeof n==`number`&&(this.world.latitudeDeg=e,this.world.longitudeDeg=n,this.locationExplicit=!0),typeof r==`number`&&(this.world.seed=r)}}catch{}}},tt=class{epochMs;deltaMs=0;settings;lastOverride=null;constructor(e){this.settings=e,this.epochMs=e.world.timeOverrideMs??Date.now(),this.lastOverride=e.world.timeOverrideMs}advance(e){let t=this.settings.world.timeOverrideMs;if(t!==null&&t!==this.lastOverride){this.epochMs=t,this.deltaMs=0,this.lastOverride=t;return}if(t===null&&this.lastOverride!==null){this.epochMs=Date.now(),this.deltaMs=0,this.lastOverride=null;return}this.lastOverride=t;let n=this.settings.world.timeScale;if(t===null&&n===1){let e=Date.now();this.deltaMs=e-this.epochMs,this.epochMs=e;return}this.deltaMs=e*1e3*n,this.epochMs+=this.deltaMs}get date(){return new Date(this.epochMs)}get localHours(){let e=this.date;return e.getHours()+e.getMinutes()/60+e.getSeconds()/3600}get timezoneOffsetMinutes(){return-this.date.getTimezoneOffset()}},nt=class extends Error{constructor(){super(`WebGL2 is required and is not available in this browser.`),this.name=`WebGL2UnsupportedError`}};async function rt(){let e=document.createElement(`canvas`).getContext(`webgl2`),t=e!==null;e?.getExtension(`WEBGL_lose_context`)?.loseContext();let n=!1,r=navigator;if(r.gpu!==void 0)try{n=await r.gpu.requestAdapter()!==null}catch{n=!1}return{webgl2:t,webgpu:n}}function it(e){let t=new k({canvas:e,antialias:!1,alpha:!1,stencil:!1,depth:!0,powerPreference:`high-performance`,preserveDrawingBuffer:!1,failIfMajorPerformanceCaveat:!1});if(!t.capabilities.isWebGL2)throw t.dispose(),new nt;t.outputColorSpace=S,t.toneMapping=0,t.toneMappingExposure=1,t.shadowMap.enabled=!0,t.shadowMap.type=1,t.shadowMap.autoUpdate=!0,t.info.autoReset=!1,t.debug.checkShaderErrors=!1;let n=t.getContext(),r=n.getExtension(`EXT_color_buffer_half_float`)!==null,i=n.getExtension(`OES_texture_float_linear`)!==null,a=`unknown`,o=n.getExtension(`WEBGL_debug_renderer_info`);if(o!==null){let e=n.getParameter(o.UNMASKED_RENDERER_WEBGL);typeof e==`string`&&(a=e)}return{renderer:t,capabilities:{maxAnisotropy:t.capabilities.getMaxAnisotropy(),maxTextureSize:t.capabilities.maxTextureSize,floatLinearFiltering:i,halfFloatRenderTargets:r,rendererName:a}}}function at(){return{ephemeris:null,windX:0,windZ:0,windSpeed:0,windDirection:0,beaufort:0,significantWaveHeight:0,fetchKm:200,cloudiness:.2,precipitation:0,visibility:25e3,pressureHpa:1013.25,temperatureC:12,tideHeight:0,exposure:1,sceneIlluminanceLux:1e4}}var ot=[.5,1.5,3.3,5.5,7.9,10.7,13.8,17.1,20.7,24.4,28.4,32.6];function st(e){for(let t=0;t<ot.length;t+=1){let n=ot[t];if(n!==void 0&&e<n)return t}return 12}var ct=class{canvas;renderer;capabilities;scene;camera;settings;time;input;resources;loop;world=at();width=1;height=1;pixelRatio=1;systems=[];resizeObserver;disposed=!1;renderOverride=null;debug=null;constructor(e,t){this.canvas=e;let{renderer:n,capabilities:r}=it(e);this.renderer=n,this.capabilities={...r,webgl2:!0,webgpu:t},this.settings=new et(r.maxAnisotropy),this.time=new tt(this.settings),this.input=new Ue(e),this.resources=new Ye(n),this.scene=new Oe,this.scene.background=new a(2896696),this.camera=new _e(52,1,.1,2e4),this.camera.position.set(0,6,14),this.camera.lookAt(0,1.5,0),this.loop=new qe(this.fixedUpdate,this.render),this.settings.onChange((e,t)=>{if(t===`graphics`){this.applyRenderScale();for(let e of this.systems)e.onSettingsChanged?.(this)}}),this.resizeObserver=new ResizeObserver(()=>this.handleResize()),this.resizeObserver.observe(e.parentElement??document.body),this.handleResize()}add(e){this.systems.push(e),this.systems.sort((e,t)=>e.priority-t.priority),e.resize?.(this.width,this.height)}get(e){return this.systems.find(t=>t.name===e)}start(){this.loop.start()}dispose(){if(!this.disposed){this.disposed=!0,this.loop.stop(),this.resizeObserver.disconnect();for(let e of this.systems)e.dispose?.();this.systems.length=0,this.input.dispose(),this.resources.dispose(),this.renderer.dispose()}}fixedUpdate=e=>{for(let t of this.systems)t.fixedUpdate?.(e,this)};render=e=>{this.debug?.beginFrame(),this.time.advance(e);for(let t of this.systems)t.update?.(e,this);for(let e of this.systems)e.beforeRender?.(this);this.renderer.info.reset(),this.renderOverride===null?this.renderer.render(this.scene,this.camera):this.renderOverride(e),this.input.endFrame(),this.debug?.endFrame(e)};handleResize(){let e=this.canvas.parentElement,t=Math.max(1,Math.floor(e?.clientWidth??window.innerWidth)),n=Math.max(1,Math.floor(e?.clientHeight??window.innerHeight));if(t!==this.width||n!==this.height){this.width=t,this.height=n,this.applyRenderScale(),this.camera.aspect=t/n,this.camera.updateProjectionMatrix();for(let e of this.systems)e.resize?.(t,n)}}applyRenderScale(){this.pixelRatio=Math.min(window.devicePixelRatio,2)*this.settings.graphics.renderScale,this.renderer.setPixelRatio(this.pixelRatio),this.renderer.setSize(this.width,this.height,!1)}};async function lt(e){let t=await rt();if(!t.webgl2)throw new nt;return new ct(e,t.webgpu)}var ut=class e{constructor(t,n,r,i,a=`div`){this.parent=t,this.object=n,this.property=r,this._disabled=!1,this._hidden=!1,this.initialValue=this.getValue(),this.domElement=document.createElement(a),this.domElement.classList.add(`lil-controller`),this.domElement.classList.add(i),this.$name=document.createElement(`div`),this.$name.classList.add(`lil-name`),e.nextNameID=e.nextNameID||0,this.$name.id=`lil-gui-name-${++e.nextNameID}`,this.$widget=document.createElement(`div`),this.$widget.classList.add(`lil-widget`),this.$disable=this.$widget,this.domElement.appendChild(this.$name),this.domElement.appendChild(this.$widget),this.domElement.addEventListener(`keydown`,e=>e.stopPropagation()),this.domElement.addEventListener(`keyup`,e=>e.stopPropagation()),this.parent.children.push(this),this.parent.controllers.push(this),this.parent.$children.appendChild(this.domElement),this._listenCallback=this._listenCallback.bind(this),this.name(r)}name(e){return this._name=e,this.$name.textContent=e,this}onChange(e){return this._onChange=e,this}_callOnChange(){this.parent._callOnChange(this),this._onChange!==void 0&&this._onChange.call(this,this.getValue()),this._changed=!0}onFinishChange(e){return this._onFinishChange=e,this}_callOnFinishChange(){this._changed&&(this.parent._callOnFinishChange(this),this._onFinishChange!==void 0&&this._onFinishChange.call(this,this.getValue())),this._changed=!1}reset(){return this.setValue(this.initialValue),this._callOnFinishChange(),this}enable(e=!0){return this.disable(!e)}disable(e=!0){return e===this._disabled?this:(this._disabled=e,this.domElement.classList.toggle(`lil-disabled`,e),this.$disable.toggleAttribute(`disabled`,e),this)}show(e=!0){return this._hidden=!e,this.domElement.style.display=this._hidden?`none`:``,this}hide(){return this.show(!1)}options(e){let t=this.parent.add(this.object,this.property,e);return t.name(this._name),this.destroy(),t}min(e){return this}max(e){return this}step(e){return this}decimals(e){return this}listen(e=!0){return this._listening=e,this._listenCallbackID!==void 0&&(cancelAnimationFrame(this._listenCallbackID),this._listenCallbackID=void 0),this._listening&&this._listenCallback(),this}_listenCallback(){this._listenCallbackID=requestAnimationFrame(this._listenCallback);let e=this.save();e!==this._listenPrevValue&&this.updateDisplay(),this._listenPrevValue=e}getValue(){return this.object[this.property]}setValue(e){return this.getValue()!==e&&(this.object[this.property]=e,this._callOnChange(),this.updateDisplay()),this}updateDisplay(){return this}load(e){return this.setValue(e),this._callOnFinishChange(),this}save(){return this.getValue()}destroy(){this.listen(!1),this.parent.children.splice(this.parent.children.indexOf(this),1),this.parent.controllers.splice(this.parent.controllers.indexOf(this),1),this.parent.$children.removeChild(this.domElement)}},dt=class extends ut{constructor(e,t,n){super(e,t,n,`lil-boolean`,`label`),this.$input=document.createElement(`input`),this.$input.setAttribute(`type`,`checkbox`),this.$input.setAttribute(`aria-labelledby`,this.$name.id),this.$widget.appendChild(this.$input),this.$input.addEventListener(`change`,()=>{this.setValue(this.$input.checked),this._callOnFinishChange()}),this.$disable=this.$input,this.updateDisplay()}updateDisplay(){return this.$input.checked=this.getValue(),this}};function ft(e){let t,n;return(t=e.match(/(#|0x)?([a-f0-9]{6})/i))?n=t[2]:(t=e.match(/rgb\(\s*(\d*)\s*,\s*(\d*)\s*,\s*(\d*)\s*\)/))?n=parseInt(t[1]).toString(16).padStart(2,0)+parseInt(t[2]).toString(16).padStart(2,0)+parseInt(t[3]).toString(16).padStart(2,0):(t=e.match(/^#?([a-f0-9])([a-f0-9])([a-f0-9])$/i))&&(n=t[1]+t[1]+t[2]+t[2]+t[3]+t[3]),n?`#`+n:!1}var pt={isPrimitive:!0,match:e=>typeof e==`string`,fromHexString:ft,toHexString:ft},mt={isPrimitive:!0,match:e=>typeof e==`number`,fromHexString:e=>parseInt(e.substring(1),16),toHexString:e=>`#`+e.toString(16).padStart(6,0)},ht=[pt,mt,{isPrimitive:!1,match:e=>Array.isArray(e)||ArrayBuffer.isView(e),fromHexString(e,t,n=1){let r=mt.fromHexString(e);t[0]=(r>>16&255)/255*n,t[1]=(r>>8&255)/255*n,t[2]=(r&255)/255*n},toHexString([e,t,n],r=1){r=255/r;let i=e*r<<16^t*r<<8^n*r<<0;return mt.toHexString(i)}},{isPrimitive:!1,match:e=>Object(e)===e,fromHexString(e,t,n=1){let r=mt.fromHexString(e);t.r=(r>>16&255)/255*n,t.g=(r>>8&255)/255*n,t.b=(r&255)/255*n},toHexString({r:e,g:t,b:n},r=1){r=255/r;let i=e*r<<16^t*r<<8^n*r<<0;return mt.toHexString(i)}}];function gt(e){return ht.find(t=>t.match(e))}var _t=class extends ut{constructor(e,t,n,r){super(e,t,n,`lil-color`),this.$input=document.createElement(`input`),this.$input.setAttribute(`type`,`color`),this.$input.setAttribute(`tabindex`,-1),this.$input.setAttribute(`aria-labelledby`,this.$name.id),this.$text=document.createElement(`input`),this.$text.setAttribute(`type`,`text`),this.$text.setAttribute(`spellcheck`,`false`),this.$text.setAttribute(`aria-labelledby`,this.$name.id),this.$display=document.createElement(`div`),this.$display.classList.add(`lil-display`),this.$display.appendChild(this.$input),this.$widget.appendChild(this.$display),this.$widget.appendChild(this.$text),this._format=gt(this.initialValue),this._rgbScale=r,this._initialValueHexString=this.save(),this._textFocused=!1,this.$input.addEventListener(`input`,()=>{this._setValueFromHexString(this.$input.value)}),this.$input.addEventListener(`blur`,()=>{this._callOnFinishChange()}),this.$text.addEventListener(`input`,()=>{let e=ft(this.$text.value);e&&this._setValueFromHexString(e)}),this.$text.addEventListener(`focus`,()=>{this._textFocused=!0,this.$text.select()}),this.$text.addEventListener(`blur`,()=>{this._textFocused=!1,this.updateDisplay(),this._callOnFinishChange()}),this.$disable=this.$text,this.updateDisplay()}reset(){return this._setValueFromHexString(this._initialValueHexString),this}_setValueFromHexString(e){if(this._format.isPrimitive){let t=this._format.fromHexString(e);this.setValue(t)}else this._format.fromHexString(e,this.getValue(),this._rgbScale),this._callOnChange(),this.updateDisplay()}save(){return this._format.toHexString(this.getValue(),this._rgbScale)}load(e){return this._setValueFromHexString(e),this._callOnFinishChange(),this}updateDisplay(){return this.$input.value=this._format.toHexString(this.getValue(),this._rgbScale),this._textFocused||(this.$text.value=this.$input.value.substring(1)),this.$display.style.backgroundColor=this.$input.value,this}},vt=class extends ut{constructor(e,t,n){super(e,t,n,`lil-function`),this.$button=document.createElement(`button`),this.$button.appendChild(this.$name),this.$widget.appendChild(this.$button),this.$button.addEventListener(`click`,e=>{e.preventDefault(),this.getValue().call(this.object),this._callOnChange()}),this.$button.addEventListener(`touchstart`,()=>{},{passive:!0}),this.$disable=this.$button}},yt=class extends ut{constructor(e,t,n,r,i,a){super(e,t,n,`lil-number`),this._initInput(),this.min(r),this.max(i);let o=a!==void 0;this.step(o?a:this._getImplicitStep(),o),this.updateDisplay()}decimals(e){return this._decimals=e,this.updateDisplay(),this}min(e){return this._min=e,this._onUpdateMinMax(),this}max(e){return this._max=e,this._onUpdateMinMax(),this}step(e,t=!0){return this._step=e,this._stepExplicit=t,this}updateDisplay(){let e=this.getValue();if(this._hasSlider){let t=(e-this._min)/(this._max-this._min);t=Math.max(0,Math.min(t,1)),this.$fill.style.width=t*100+`%`}return this._inputFocused||(this.$input.value=this._decimals===void 0?e:e.toFixed(this._decimals)),this}_initInput(){this.$input=document.createElement(`input`),this.$input.setAttribute(`type`,`text`),this.$input.setAttribute(`aria-labelledby`,this.$name.id),window.matchMedia(`(pointer: coarse)`).matches&&(this.$input.setAttribute(`type`,`number`),this.$input.setAttribute(`step`,`any`)),this.$widget.appendChild(this.$input),this.$disable=this.$input;let e=()=>{let e=parseFloat(this.$input.value);isNaN(e)||(this._stepExplicit&&(e=this._snap(e)),this.setValue(this._clamp(e)))},t=e=>{let t=parseFloat(this.$input.value);isNaN(t)||(this._snapClampSetValue(t+e),this.$input.value=this.getValue())},n=e=>{e.key===`Enter`&&this.$input.blur(),e.code===`ArrowUp`&&(e.preventDefault(),t(this._step*this._arrowKeyMultiplier(e))),e.code===`ArrowDown`&&(e.preventDefault(),t(this._step*this._arrowKeyMultiplier(e)*-1))},r=e=>{this._inputFocused&&(e.preventDefault(),t(this._step*this._normalizeMouseWheel(e)))},i=!1,a,o,s,c,l,u=e=>{a=e.clientX,o=s=e.clientY,i=!0,c=this.getValue(),l=0,window.addEventListener(`mousemove`,d),window.addEventListener(`mouseup`,f)},d=e=>{if(i){let t=e.clientX-a,n=e.clientY-o;Math.abs(n)>5?(e.preventDefault(),this.$input.blur(),i=!1,this._setDraggingStyle(!0,`vertical`)):Math.abs(t)>5&&f()}if(!i){let t=e.clientY-s;l-=t*this._step*this._arrowKeyMultiplier(e),c+l>this._max?l=this._max-c:c+l<this._min&&(l=this._min-c),this._snapClampSetValue(c+l)}s=e.clientY},f=()=>{this._setDraggingStyle(!1,`vertical`),this._callOnFinishChange(),window.removeEventListener(`mousemove`,d),window.removeEventListener(`mouseup`,f)};this.$input.addEventListener(`input`,e),this.$input.addEventListener(`keydown`,n),this.$input.addEventListener(`wheel`,r,{passive:!1}),this.$input.addEventListener(`mousedown`,u),this.$input.addEventListener(`focus`,()=>{this._inputFocused=!0}),this.$input.addEventListener(`blur`,()=>{this._inputFocused=!1,this.updateDisplay(),this._callOnFinishChange()})}_initSlider(){this._hasSlider=!0,this.$slider=document.createElement(`div`),this.$slider.classList.add(`lil-slider`),this.$fill=document.createElement(`div`),this.$fill.classList.add(`lil-fill`),this.$slider.appendChild(this.$fill),this.$widget.insertBefore(this.$slider,this.$input),this.domElement.classList.add(`lil-has-slider`);let e=(e,t,n,r,i)=>(e-t)/(n-t)*(i-r)+r,t=t=>{let n=this.$slider.getBoundingClientRect(),r=e(t,n.left,n.right,this._min,this._max);this._snapClampSetValue(r)},n=e=>{this._setDraggingStyle(!0),t(e.clientX),window.addEventListener(`mousemove`,r),window.addEventListener(`mouseup`,i)},r=e=>{t(e.clientX)},i=()=>{this._callOnFinishChange(),this._setDraggingStyle(!1),window.removeEventListener(`mousemove`,r),window.removeEventListener(`mouseup`,i)},a=!1,o,s,c=e=>{e.preventDefault(),this._setDraggingStyle(!0),t(e.touches[0].clientX),a=!1},l=e=>{e.touches.length>1||(this._hasScrollBar?(o=e.touches[0].clientX,s=e.touches[0].clientY,a=!0):c(e),window.addEventListener(`touchmove`,u,{passive:!1}),window.addEventListener(`touchend`,d))},u=e=>{if(a){let t=e.touches[0].clientX-o,n=e.touches[0].clientY-s;Math.abs(t)>Math.abs(n)?c(e):(window.removeEventListener(`touchmove`,u),window.removeEventListener(`touchend`,d))}else e.preventDefault(),t(e.touches[0].clientX)},d=()=>{this._callOnFinishChange(),this._setDraggingStyle(!1),window.removeEventListener(`touchmove`,u),window.removeEventListener(`touchend`,d)},f=this._callOnFinishChange.bind(this),p;this.$slider.addEventListener(`mousedown`,n),this.$slider.addEventListener(`touchstart`,l,{passive:!1}),this.$slider.addEventListener(`wheel`,e=>{if(Math.abs(e.deltaX)<Math.abs(e.deltaY)&&this._hasScrollBar)return;e.preventDefault();let t=this._normalizeMouseWheel(e)*this._step;this._snapClampSetValue(this.getValue()+t),this.$input.value=this.getValue(),clearTimeout(p),p=setTimeout(f,400)},{passive:!1})}_setDraggingStyle(e,t=`horizontal`){this.$slider&&this.$slider.classList.toggle(`lil-active`,e),document.body.classList.toggle(`lil-dragging`,e),document.body.classList.toggle(`lil-${t}`,e)}_getImplicitStep(){return this._hasMin&&this._hasMax?(this._max-this._min)/1e3:.1}_onUpdateMinMax(){!this._hasSlider&&this._hasMin&&this._hasMax&&(this._stepExplicit||this.step(this._getImplicitStep(),!1),this._initSlider(),this.updateDisplay())}_normalizeMouseWheel(e){let{deltaX:t,deltaY:n}=e;return Math.floor(e.deltaY)!==e.deltaY&&e.wheelDelta&&(t=0,n=-e.wheelDelta/120,n*=this._stepExplicit?1:10),t+-n}_arrowKeyMultiplier(e){let t=this._stepExplicit?1:10;return e.shiftKey?t*=10:e.altKey&&(t/=10),t}_snap(e){let t=0;return this._hasMin?t=this._min:this._hasMax&&(t=this._max),e-=t,e=Math.round(e/this._step)*this._step,e+=t,e=parseFloat(e.toPrecision(15)),e}_clamp(e){return e<this._min&&(e=this._min),e>this._max&&(e=this._max),e}_snapClampSetValue(e){this.setValue(this._clamp(this._snap(e)))}get _hasScrollBar(){let e=this.parent.root.$children;return e.scrollHeight>e.clientHeight}get _hasMin(){return this._min!==void 0}get _hasMax(){return this._max!==void 0}},bt=class extends ut{constructor(e,t,n,r){super(e,t,n,`lil-option`),this.$select=document.createElement(`select`),this.$select.setAttribute(`aria-labelledby`,this.$name.id),this.$display=document.createElement(`div`),this.$display.classList.add(`lil-display`),this.$select.addEventListener(`change`,()=>{this.setValue(this._values[this.$select.selectedIndex]),this._callOnFinishChange()}),this.$select.addEventListener(`focus`,()=>{this.$display.classList.add(`lil-focus`)}),this.$select.addEventListener(`blur`,()=>{this.$display.classList.remove(`lil-focus`)}),this.$widget.appendChild(this.$select),this.$widget.appendChild(this.$display),this.$disable=this.$select,this.options(r)}options(e){return this._values=Array.isArray(e)?e:Object.values(e),this._names=Array.isArray(e)?e:Object.keys(e),this.$select.replaceChildren(),this._names.forEach(e=>{let t=document.createElement(`option`);t.textContent=e,this.$select.appendChild(t)}),this.updateDisplay(),this}updateDisplay(){let e=this.getValue(),t=this._values.indexOf(e);return this.$select.selectedIndex=t,this.$display.textContent=t===-1?e:this._names[t],this}},xt=class extends ut{constructor(e,t,n){super(e,t,n,`lil-string`),this.$input=document.createElement(`input`),this.$input.setAttribute(`type`,`text`),this.$input.setAttribute(`spellcheck`,`false`),this.$input.setAttribute(`aria-labelledby`,this.$name.id),this.$input.addEventListener(`input`,()=>{this.setValue(this.$input.value)}),this.$input.addEventListener(`keydown`,e=>{e.code===`Enter`&&this.$input.blur()}),this.$input.addEventListener(`blur`,()=>{this._callOnFinishChange()}),this.$widget.appendChild(this.$input),this.$disable=this.$input,this.updateDisplay()}updateDisplay(){return this.$input.value=this.getValue(),this}},St=`.lil-gui {
  font-family: var(--font-family);
  font-size: var(--font-size);
  line-height: 1;
  font-weight: normal;
  font-style: normal;
  text-align: left;
  color: var(--text-color);
  user-select: none;
  -webkit-user-select: none;
  touch-action: manipulation;
  --background-color: #1f1f1f;
  --text-color: #ebebeb;
  --title-background-color: #111111;
  --title-text-color: #ebebeb;
  --widget-color: #424242;
  --hover-color: #4f4f4f;
  --focus-color: #595959;
  --number-color: #2cc9ff;
  --string-color: #a2db3c;
  --font-size: 11px;
  --input-font-size: 11px;
  --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
  --font-family-mono: Menlo, Monaco, Consolas, "Droid Sans Mono", monospace;
  --padding: 4px;
  --spacing: 4px;
  --widget-height: 20px;
  --title-height: calc(var(--widget-height) + var(--spacing) * 1.25);
  --name-width: 45%;
  --slider-knob-width: 2px;
  --slider-input-width: 27%;
  --color-input-width: 27%;
  --slider-input-min-width: 45px;
  --color-input-min-width: 45px;
  --folder-indent: 7px;
  --widget-padding: 0 0 0 3px;
  --widget-border-radius: 2px;
  --checkbox-size: calc(0.75 * var(--widget-height));
  --scrollbar-width: 5px;
}
.lil-gui, .lil-gui * {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
.lil-gui.lil-root {
  width: var(--width, 245px);
  display: flex;
  flex-direction: column;
  background: var(--background-color);
}
.lil-gui.lil-root > .lil-title {
  background: var(--title-background-color);
  color: var(--title-text-color);
}
.lil-gui.lil-root > .lil-children {
  overflow-x: hidden;
  overflow-y: auto;
}
.lil-gui.lil-root > .lil-children::-webkit-scrollbar {
  width: var(--scrollbar-width);
  height: var(--scrollbar-width);
  background: var(--background-color);
}
.lil-gui.lil-root > .lil-children::-webkit-scrollbar-thumb {
  border-radius: var(--scrollbar-width);
  background: var(--focus-color);
}
@media (pointer: coarse) {
  .lil-gui.lil-allow-touch-styles, .lil-gui.lil-allow-touch-styles .lil-gui {
    --widget-height: 28px;
    --padding: 6px;
    --spacing: 6px;
    --font-size: 13px;
    --input-font-size: 16px;
    --folder-indent: 10px;
    --scrollbar-width: 7px;
    --slider-input-min-width: 50px;
    --color-input-min-width: 65px;
  }
}
.lil-gui.lil-force-touch-styles, .lil-gui.lil-force-touch-styles .lil-gui {
  --widget-height: 28px;
  --padding: 6px;
  --spacing: 6px;
  --font-size: 13px;
  --input-font-size: 16px;
  --folder-indent: 10px;
  --scrollbar-width: 7px;
  --slider-input-min-width: 50px;
  --color-input-min-width: 65px;
}
.lil-gui.lil-auto-place, .lil-gui.autoPlace {
  max-height: 100%;
  position: fixed;
  top: 0;
  right: 15px;
  z-index: 1001;
}

.lil-controller {
  display: flex;
  align-items: center;
  padding: 0 var(--padding);
  margin: var(--spacing) 0;
}
.lil-controller.lil-disabled {
  opacity: 0.5;
}
.lil-controller.lil-disabled, .lil-controller.lil-disabled * {
  pointer-events: none !important;
}
.lil-controller > .lil-name {
  min-width: var(--name-width);
  flex-shrink: 0;
  white-space: pre;
  padding-right: var(--spacing);
  line-height: var(--widget-height);
}
.lil-controller .lil-widget {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  min-height: var(--widget-height);
}
.lil-controller.lil-string input {
  color: var(--string-color);
}
.lil-controller.lil-boolean {
  cursor: pointer;
}
.lil-controller.lil-color .lil-display {
  width: 100%;
  height: var(--widget-height);
  border-radius: var(--widget-border-radius);
  position: relative;
}
@media (hover: hover) {
  .lil-controller.lil-color .lil-display:hover:before {
    content: " ";
    display: block;
    position: absolute;
    border-radius: var(--widget-border-radius);
    border: 1px solid #fff9;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
  }
}
.lil-controller.lil-color input[type=color] {
  opacity: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
}
.lil-controller.lil-color input[type=text] {
  margin-left: var(--spacing);
  font-family: var(--font-family-mono);
  min-width: var(--color-input-min-width);
  width: var(--color-input-width);
  flex-shrink: 0;
}
.lil-controller.lil-option select {
  opacity: 0;
  position: absolute;
  width: 100%;
  max-width: 100%;
}
.lil-controller.lil-option .lil-display {
  position: relative;
  pointer-events: none;
  border-radius: var(--widget-border-radius);
  height: var(--widget-height);
  line-height: var(--widget-height);
  max-width: 100%;
  overflow: hidden;
  word-break: break-all;
  padding-left: 0.55em;
  padding-right: 1.75em;
  background: var(--widget-color);
}
@media (hover: hover) {
  .lil-controller.lil-option .lil-display.lil-focus {
    background: var(--focus-color);
  }
}
.lil-controller.lil-option .lil-display.lil-active {
  background: var(--focus-color);
}
.lil-controller.lil-option .lil-display:after {
  font-family: "lil-gui";
  content: "↕";
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  padding-right: 0.375em;
}
.lil-controller.lil-option .lil-widget,
.lil-controller.lil-option select {
  cursor: pointer;
}
@media (hover: hover) {
  .lil-controller.lil-option .lil-widget:hover .lil-display {
    background: var(--hover-color);
  }
}
.lil-controller.lil-number input {
  color: var(--number-color);
}
.lil-controller.lil-number.lil-has-slider input {
  margin-left: var(--spacing);
  width: var(--slider-input-width);
  min-width: var(--slider-input-min-width);
  flex-shrink: 0;
}
.lil-controller.lil-number .lil-slider {
  width: 100%;
  height: var(--widget-height);
  background: var(--widget-color);
  border-radius: var(--widget-border-radius);
  padding-right: var(--slider-knob-width);
  overflow: hidden;
  cursor: ew-resize;
  touch-action: pan-y;
}
@media (hover: hover) {
  .lil-controller.lil-number .lil-slider:hover {
    background: var(--hover-color);
  }
}
.lil-controller.lil-number .lil-slider.lil-active {
  background: var(--focus-color);
}
.lil-controller.lil-number .lil-slider.lil-active .lil-fill {
  opacity: 0.95;
}
.lil-controller.lil-number .lil-fill {
  height: 100%;
  border-right: var(--slider-knob-width) solid var(--number-color);
  box-sizing: content-box;
}

.lil-dragging .lil-gui {
  --hover-color: var(--widget-color);
}
.lil-dragging * {
  cursor: ew-resize !important;
}
.lil-dragging.lil-vertical * {
  cursor: ns-resize !important;
}

.lil-gui .lil-title {
  height: var(--title-height);
  font-weight: 600;
  padding: 0 var(--padding);
  width: 100%;
  text-align: left;
  background: none;
  text-decoration-skip: objects;
}
.lil-gui .lil-title:before {
  font-family: "lil-gui";
  content: "▾";
  padding-right: 2px;
  display: inline-block;
}
.lil-gui .lil-title:active {
  background: var(--title-background-color);
  opacity: 0.75;
}
@media (hover: hover) {
  body:not(.lil-dragging) .lil-gui .lil-title:hover {
    background: var(--title-background-color);
    opacity: 0.85;
  }
  .lil-gui .lil-title:focus {
    text-decoration: underline var(--focus-color);
  }
}
.lil-gui.lil-root > .lil-title:focus {
  text-decoration: none !important;
}
.lil-gui.lil-closed > .lil-title:before {
  content: "▸";
}
.lil-gui.lil-closed > .lil-children {
  transform: translateY(-7px);
  opacity: 0;
}
.lil-gui.lil-closed:not(.lil-transition) > .lil-children {
  display: none;
}
.lil-gui.lil-transition > .lil-children {
  transition-duration: 300ms;
  transition-property: height, opacity, transform;
  transition-timing-function: cubic-bezier(0.2, 0.6, 0.35, 1);
  overflow: hidden;
  pointer-events: none;
}
.lil-gui .lil-children:empty:before {
  content: "Empty";
  padding: 0 var(--padding);
  margin: var(--spacing) 0;
  display: block;
  height: var(--widget-height);
  font-style: italic;
  line-height: var(--widget-height);
  opacity: 0.5;
}
.lil-gui.lil-root > .lil-children > .lil-gui > .lil-title {
  border: 0 solid var(--widget-color);
  border-width: 1px 0;
  transition: border-color 300ms;
}
.lil-gui.lil-root > .lil-children > .lil-gui.lil-closed > .lil-title {
  border-bottom-color: transparent;
}
.lil-gui + .lil-controller {
  border-top: 1px solid var(--widget-color);
  margin-top: 0;
  padding-top: var(--spacing);
}
.lil-gui .lil-gui .lil-gui > .lil-title {
  border: none;
}
.lil-gui .lil-gui .lil-gui > .lil-children {
  border: none;
  margin-left: var(--folder-indent);
  border-left: 2px solid var(--widget-color);
}
.lil-gui .lil-gui .lil-controller {
  border: none;
}

.lil-gui label, .lil-gui input, .lil-gui button {
  -webkit-tap-highlight-color: transparent;
}
.lil-gui input {
  border: 0;
  outline: none;
  font-family: var(--font-family);
  font-size: var(--input-font-size);
  border-radius: var(--widget-border-radius);
  height: var(--widget-height);
  background: var(--widget-color);
  color: var(--text-color);
  width: 100%;
}
@media (hover: hover) {
  .lil-gui input:hover {
    background: var(--hover-color);
  }
  .lil-gui input:active {
    background: var(--focus-color);
  }
}
.lil-gui input:disabled {
  opacity: 1;
}
.lil-gui input[type=text],
.lil-gui input[type=number] {
  padding: var(--widget-padding);
  -moz-appearance: textfield;
}
.lil-gui input[type=text]:focus,
.lil-gui input[type=number]:focus {
  background: var(--focus-color);
}
.lil-gui input[type=checkbox] {
  appearance: none;
  width: var(--checkbox-size);
  height: var(--checkbox-size);
  border-radius: var(--widget-border-radius);
  text-align: center;
  cursor: pointer;
}
.lil-gui input[type=checkbox]:checked:before {
  font-family: "lil-gui";
  content: "✓";
  font-size: var(--checkbox-size);
  line-height: var(--checkbox-size);
}
@media (hover: hover) {
  .lil-gui input[type=checkbox]:focus {
    box-shadow: inset 0 0 0 1px var(--focus-color);
  }
}
.lil-gui button {
  outline: none;
  cursor: pointer;
  font-family: var(--font-family);
  font-size: var(--font-size);
  color: var(--text-color);
  width: 100%;
  border: none;
}
.lil-gui .lil-controller button {
  height: var(--widget-height);
  text-transform: none;
  background: var(--widget-color);
  border-radius: var(--widget-border-radius);
}
@media (hover: hover) {
  .lil-gui .lil-controller button:hover {
    background: var(--hover-color);
  }
  .lil-gui .lil-controller button:focus {
    box-shadow: inset 0 0 0 1px var(--focus-color);
  }
}
.lil-gui .lil-controller button:active {
  background: var(--focus-color);
}

@font-face {
  font-family: "lil-gui";
  src: url("data:application/font-woff2;charset=utf-8;base64,d09GMgABAAAAAALkAAsAAAAABtQAAAKVAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHFQGYACDMgqBBIEbATYCJAMUCwwABCAFhAoHgQQbHAbIDiUFEYVARAAAYQTVWNmz9MxhEgodq49wYRUFKE8GWNiUBxI2LBRaVnc51U83Gmhs0Q7JXWMiz5eteLwrKwuxHO8VFxUX9UpZBs6pa5ABRwHA+t3UxUnH20EvVknRerzQgX6xC/GH6ZUvTcAjAv122dF28OTqCXrPuyaDER30YBA1xnkVutDDo4oCi71Ca7rrV9xS8dZHbPHefsuwIyCpmT7j+MnjAH5X3984UZoFFuJ0yiZ4XEJFxjagEBeqs+e1iyK8Xf/nOuwF+vVK0ur765+vf7txotUi0m3N0m/84RGSrBCNrh8Ee5GjODjF4gnWP+dJrH/Lk9k4oT6d+gr6g/wssA2j64JJGP6cmx554vUZnpZfn6ZfX2bMwPPrlANsB86/DiHjhl0OP+c87+gaJo/gY084s3HoYL/ZkWHTRfBXvvoHnnkHvngKun4KBE/ede7tvq3/vQOxDXB1/fdNz6XbPdcr0Vhpojj9dG+owuSKFsslCi1tgEjirjXdwMiov2EioadxmqTHUCIwo8NgQaeIasAi0fTYSPTbSmwbMOFduyh9wvBrESGY0MtgRjtgQR8Q1bRPohn2UoCRZf9wyYANMXFeJTysqAe0I4mrherOekFdKMrYvJjLvOIUM9SuwYB5DVZUwwVjJJOaUnZCmcEkIZZrKqNvRGRMvmFZsmhP4VMKCSXBhSqUBxgMS7h0cZvEd71AWkEhGWaeMFcNnpqyJkyXgYL7PQ1MoSq0wDAkRtJIijkZSmqYTiSImfLiSWXIZwhRh3Rug2X0kk1Dgj+Iu43u5p98ghopcpSo0Uyc8SnjlYX59WUeaMoDqmVD2TOWD9a4pCRAzf2ECgwGcrHjPOWY9bNxq/OL3I/QjwEAAAA=") format("woff2");
}`;function Ct(e){let t=document.createElement(`style`);t.innerHTML=e;let n=document.querySelector(`head link[rel=stylesheet], head style`);n?document.head.insertBefore(t,n):document.head.appendChild(t)}var wt=!1,Tt=class e{constructor({parent:e,autoPlace:t=e===void 0,container:n,width:r,title:i=`Controls`,closeFolders:a=!1,injectStyles:o=!0,touchStyles:s=!0}={}){if(this.parent=e,this.root=e?e.root:this,this.children=[],this.controllers=[],this.folders=[],this._closed=!1,this._hidden=!1,this.domElement=document.createElement(`div`),this.domElement.classList.add(`lil-gui`),this.$title=document.createElement(`button`),this.$title.classList.add(`lil-title`),this.$title.setAttribute(`aria-expanded`,!0),this.$title.addEventListener(`click`,()=>this.openAnimated(this._closed)),this.$title.addEventListener(`touchstart`,()=>{},{passive:!0}),this.$children=document.createElement(`div`),this.$children.classList.add(`lil-children`),this.domElement.appendChild(this.$title),this.domElement.appendChild(this.$children),this.title(i),this.parent){this.parent.children.push(this),this.parent.folders.push(this),this.parent.$children.appendChild(this.domElement);return}this.domElement.classList.add(`lil-root`),s&&this.domElement.classList.add(`lil-allow-touch-styles`),!wt&&o&&(Ct(St),wt=!0),n?n.appendChild(this.domElement):t&&(this.domElement.classList.add(`lil-auto-place`,`autoPlace`),document.body.appendChild(this.domElement)),r&&this.domElement.style.setProperty(`--width`,r+`px`),this._closeFolders=a}add(e,t,n,r,i){if(Object(n)===n)return new bt(this,e,t,n);let a=e[t];switch(typeof a){case`number`:return new yt(this,e,t,n,r,i);case`boolean`:return new dt(this,e,t);case`string`:return new xt(this,e,t);case`function`:return new vt(this,e,t)}console.error(`gui.add failed
	property:`,t,`
	object:`,e,`
	value:`,a)}addColor(e,t,n=1){return new _t(this,e,t,n)}addFolder(t){let n=new e({parent:this,title:t});return this.root._closeFolders&&n.close(),n}load(e,t=!0){return e.controllers&&this.controllers.forEach(t=>{t instanceof vt||t._name in e.controllers&&t.load(e.controllers[t._name])}),t&&e.folders&&this.folders.forEach(t=>{t._title in e.folders&&t.load(e.folders[t._title])}),this}save(e=!0){let t={controllers:{},folders:{}};return this.controllers.forEach(e=>{if(!(e instanceof vt)){if(e._name in t.controllers)throw Error(`Cannot save GUI with duplicate property "${e._name}"`);t.controllers[e._name]=e.save()}}),e&&this.folders.forEach(e=>{if(e._title in t.folders)throw Error(`Cannot save GUI with duplicate folder "${e._title}"`);t.folders[e._title]=e.save()}),t}open(e=!0){return this._setClosed(!e),this.$title.setAttribute(`aria-expanded`,!this._closed),this.domElement.classList.toggle(`lil-closed`,this._closed),this}close(){return this.open(!1)}_setClosed(e){this._closed!==e&&(this._closed=e,this._callOnOpenClose(this))}show(e=!0){return this._hidden=!e,this.domElement.style.display=this._hidden?`none`:``,this}hide(){return this.show(!1)}openAnimated(e=!0){return this._setClosed(!e),this.$title.setAttribute(`aria-expanded`,!this._closed),requestAnimationFrame(()=>{let t=this.$children.clientHeight;this.$children.style.height=t+`px`,this.domElement.classList.add(`lil-transition`);let n=e=>{e.target===this.$children&&(this.$children.style.height=``,this.domElement.classList.remove(`lil-transition`),this.$children.removeEventListener(`transitionend`,n))};this.$children.addEventListener(`transitionend`,n);let r=e?this.$children.scrollHeight:0;this.domElement.classList.toggle(`lil-closed`,!e),requestAnimationFrame(()=>{this.$children.style.height=r+`px`})}),this}title(e){return this._title=e,this.$title.textContent=e,this}reset(e=!0){return(e?this.controllersRecursive():this.controllers).forEach(e=>e.reset()),this}onChange(e){return this._onChange=e,this}_callOnChange(e){this.parent&&this.parent._callOnChange(e),this._onChange!==void 0&&this._onChange.call(this,{object:e.object,property:e.property,value:e.getValue(),controller:e})}onFinishChange(e){return this._onFinishChange=e,this}_callOnFinishChange(e){this.parent&&this.parent._callOnFinishChange(e),this._onFinishChange!==void 0&&this._onFinishChange.call(this,{object:e.object,property:e.property,value:e.getValue(),controller:e})}onOpenClose(e){return this._onOpenClose=e,this}_callOnOpenClose(e){this.parent&&this.parent._callOnOpenClose(e),this._onOpenClose!==void 0&&this._onOpenClose.call(this,e)}destroy(){this.parent&&(this.parent.children.splice(this.parent.children.indexOf(this),1),this.parent.folders.splice(this.parent.folders.indexOf(this),1)),this.domElement.parentElement&&this.domElement.parentElement.removeChild(this.domElement),Array.from(this.children).forEach(e=>e.destroy())}controllersRecursive(){let e=Array.from(this.controllers);return this.folders.forEach(t=>{e=e.concat(t.controllersRecursive())}),e}foldersRecursive(){let e=Array.from(this.folders);return this.folders.forEach(t=>{e=e.concat(t.foldersRecursive())}),e}},Et=Ve(ze(((e,t)=>{(function(n,r){typeof e==`object`&&t!==void 0?t.exports=r():typeof define==`function`&&define.amd?define(r):n.Stats=r()})(e,function(){var e=function(){function t(e){return i.appendChild(e.dom),e}function n(e){for(var t=0;t<i.children.length;t++)i.children[t].style.display=t===e?`block`:`none`;r=e}var r=0,i=document.createElement(`div`);i.style.cssText=`position:fixed;top:0;left:0;cursor:pointer;opacity:0.9;z-index:10000`,i.addEventListener(`click`,function(e){e.preventDefault(),n(++r%i.children.length)},!1);var a=(performance||Date).now(),o=a,s=0,c=t(new e.Panel(`FPS`,`#0ff`,`#002`)),l=t(new e.Panel(`MS`,`#0f0`,`#020`));if(self.performance&&self.performance.memory)var u=t(new e.Panel(`MB`,`#f08`,`#201`));return n(0),{REVISION:16,dom:i,addPanel:t,showPanel:n,begin:function(){a=(performance||Date).now()},end:function(){s++;var e=(performance||Date).now();if(l.update(e-a,200),e>o+1e3&&(c.update(1e3*s/(e-o),100),o=e,s=0,u)){var t=performance.memory;u.update(t.usedJSHeapSize/1048576,t.jsHeapSizeLimit/1048576)}return e},update:function(){a=this.end()},domElement:i,setMode:n}};return e.Panel=function(e,t,n){var r=1/0,i=0,a=Math.round,o=a(window.devicePixelRatio||1),s=80*o,c=48*o,l=3*o,u=2*o,d=3*o,f=15*o,p=74*o,m=30*o,h=document.createElement(`canvas`);h.width=s,h.height=c,h.style.cssText=`width:80px;height:48px`;var g=h.getContext(`2d`);return g.font=`bold `+9*o+`px Helvetica,Arial,sans-serif`,g.textBaseline=`top`,g.fillStyle=n,g.fillRect(0,0,s,c),g.fillStyle=t,g.fillText(e,l,u),g.fillRect(d,f,p,m),g.fillStyle=n,g.globalAlpha=.9,g.fillRect(d,f,p,m),{dom:h,update:function(c,_){r=Math.min(r,c),i=Math.max(i,c),g.fillStyle=n,g.globalAlpha=1,g.fillRect(0,0,s,f),g.fillStyle=t,g.fillText(a(c)+` `+e+` (`+a(r)+`-`+a(i)+`)`,l,u),g.drawImage(h,d+o,f,p-o,m,d,f,p-o,m),g.fillRect(d+p-o,f,o,m),g.fillStyle=n,g.globalAlpha=.9,g.fillRect(d+p-o,f,o,a((1-c/_)*m))}}},e})}))(),1),Dt=class{gui;stats;engine;drawStats;container;visible=!1;accumulator=0;constructor(e){this.engine=e,this.container=document.createElement(`div`),this.container.className=`debug-overlay`,this.container.hidden=!0,document.body.appendChild(this.container),this.stats=new Et.default,this.stats.showPanel(0),this.stats.dom.classList.add(`debug-stats`),this.stats.dom.style.position=`absolute`,this.stats.dom.style.left=`0`,this.stats.dom.style.top=`0`,this.container.appendChild(this.stats.dom),this.gui=new Tt({title:`Endless Fishing — debug`,width:320,container:this.container}),this.gui.domElement.style.position=`absolute`,this.gui.domElement.style.right=`0`,this.gui.domElement.style.top=`0`,this.drawStats={fps:`60.0`,frameMs:`0.00`,drawCalls:0,triangles:`0`,programs:0,geometries:0,textures:0,gpu:e.capabilities.rendererName,webgpuAvailable:e.capabilities.webgpu?`yes (unused — see DECISIONS.md)`:`no`};let t=this.gui.addFolder(`Performance`);t.add(this.drawStats,`fps`).name(`FPS`).listen().disable(),t.add(this.drawStats,`frameMs`).name(`frame (ms)`).listen().disable(),t.add(this.drawStats,`drawCalls`).name(`draw calls`).listen().disable(),t.add(this.drawStats,`triangles`).name(`triangles`).listen().disable(),t.add(this.drawStats,`programs`).name(`programs`).listen().disable(),t.add(this.drawStats,`geometries`).name(`geometries`).listen().disable(),t.add(this.drawStats,`textures`).name(`textures`).listen().disable(),t.add(this.drawStats,`gpu`).name(`GPU`).listen().disable(),t.add(this.drawStats,`webgpuAvailable`).name(`WebGPU`).listen().disable();let n=this.gui.addFolder(`Graphics`),r={preset:e.settings.graphics.preset};n.add(r,`preset`,[`low`,`medium`,`high`,`ultra`]).name(`preset`).onChange(t=>e.settings.applyPreset(t)),n.add(e.settings.graphics,`renderScale`,.5,1.5,.05).name(`render scale`).onChange(()=>e.settings.emit(`graphics`)),window.addEventListener(`keydown`,this.onKeyDown)}folder(e){return this.gui.addFolder(e)}beginFrame(){this.visible&&this.stats.begin()}endFrame(e){if(!this.visible||(this.stats.end(),this.accumulator+=e,this.accumulator<.2))return;this.accumulator=0;let t=this.engine.renderer.info;this.drawStats.fps=this.engine.loop.fps.toFixed(1),this.drawStats.frameMs=this.engine.loop.frameMs.toFixed(2),this.drawStats.drawCalls=t.render.calls,this.drawStats.triangles=t.render.triangles.toLocaleString(`en-GB`),this.drawStats.programs=t.programs?.length??0,this.drawStats.geometries=t.memory.geometries,this.drawStats.textures=t.memory.textures}toggle(){this.visible=!this.visible,this.container.hidden=!this.visible}dispose(){window.removeEventListener(`keydown`,this.onKeyDown),this.gui.destroy(),this.container.remove()}onKeyDown=e=>{if(e.code!==`Backquote`||e.ctrlKey||e.metaKey||e.altKey)return;let t=e.target;t instanceof HTMLInputElement||t instanceof HTMLSelectElement||(e.preventDefault(),this.toggle())}};function Ot(e){let t=!1,n=()=>{t=!0};requestAnimationFrame(()=>requestAnimationFrame(n));let r={version:1,ready(){return t},setTime(t){if(t===null)e.settings.world.timeOverrideMs=null;else{let n=Date.parse(t);if(Number.isNaN(n))throw Error(`Not a parsable date: ${t}`);e.settings.world.timeOverrideMs=n}e.settings.emit(`world`),e.get(`sky`)?.resetAdaptation()},setTimeScale(t){e.settings.world.timeScale=Math.max(0,t),e.settings.emit(`world`)},setLocation(t,n){e.settings.setLocation(t,n)},setWeather(t){e.get(`sky`)?.setWeather(t)},setWeatherState(t){e.settings.world.weatherOverride=t,e.settings.emit(`world`)},setWind(t,n){let r=n*Math.PI/180;e.world.windSpeed=Math.max(0,t),e.world.windDirection=r,e.world.windX=Math.sin(r)*e.world.windSpeed,e.world.windZ=-Math.cos(r)*e.world.windSpeed},setCloudiness(t){e.world.cloudiness=Math.min(1,Math.max(0,t))},setPreset(t){e.settings.applyPreset(t)},setGraphics(t){Object.assign(e.settings.graphics,t),e.settings.emit(`graphics`)},stats(){let t=e.renderer.info;return{fps:e.loop.fps,frameMs:e.loop.frameMs,drawCalls:t.render.calls,triangles:t.render.triangles,programs:t.programs?.length??0,geometries:t.memory.geometries,textures:t.memory.textures,renderer:e.capabilities.rendererName,webgpuAvailable:e.capabilities.webgpu,preset:e.settings.graphics.preset,pixelRatio:e.pixelRatio,usingComposer:e.renderOverride!==null}},helm(){let t=e.get(`boat`);return t===void 0?null:{speedKnots:t.speedKnots,headingDeg:t.heading*180/Math.PI,throttle:t.throttleSetting,wettedFraction:t.solver.wettedFraction,anchored:t.isAnchored}},fishing(){let t=e.get(`fishing`);if(t===void 0)return null;let n=t.lastCatch;return{state:t.state,tension:t.tension,hooked:t.hooked,fishDistanceM:t.fishDistanceM,lastCatch:n===null?null:{species:n.species.name,massKg:n.massKg,lengthM:n.lengthM,value:n.value}}},clouds(){return e.get(`clouds`)?.diagnostics(e.renderer)??null},ephemeris(){let t=e.world.ephemeris;if(t===null)return null;let n=new Date(e.time.epochMs);return{utc:n.toISOString(),localTime:n.toLocaleTimeString(`en-GB`),latitudeDeg:t.location.latitudeDeg,longitudeDeg:t.location.longitudeDeg,sunAltitudeDeg:t.sunAltitudeDeg,sunAzimuthDeg:t.sunAzimuthDeg,moonAltitudeDeg:t.moonAltitudeDeg,moonAzimuthDeg:t.moonAzimuthDeg,moonIlluminatedFraction:t.moon.illuminatedFraction,moonPhase:t.moon.phaseName,twilight:t.twilight,sunIlluminanceLux:t.sunIlluminanceLux,moonIlluminanceLux:t.moonIlluminanceLux,exposure:e.world.exposure,significantWaveHeight:e.world.significantWaveHeight,beaufort:e.world.beaufort,windSpeed:e.world.windSpeed,cloudiness:e.world.cloudiness,precipitation:e.world.precipitation,visibilityM:e.world.visibility}},waveParity(){let t=e.get(`ocean`);return t===void 0?null:t.parityCheck(e)},photometry(){let t=e.get(`sky`);if(t===void 0)return null;let n=t.atmosphere.sampleSkyView(e.renderer,.5,1),r=t.atmosphere.sampleSkyView(e.renderer,.5,.51),i=t.skyIntensity,a=e=>(.2126*e[0]+.7152*e[1]+.0722*e[2])*i,o=t.nightFloor,s=a(n)+o,c=a(r)+o*.55,l=e.world.exposure;return{zenithLuminance:s,horizonLuminance:c,exposure:l,exposedZenith:s*l,exposedHorizon:c*l}}};return window.endlessFishing=r,r}var kt=class{root;fill;status;done=!1;constructor(){let e=document.getElementById(`loading`),t=document.getElementById(`loading-fill`),n=document.getElementById(`loading-status`);if(e===null||t===null||n===null)throw Error(`Loading screen markup is missing from index.html`);this.root=e,this.fill=t,this.status=n}set(e,t){if(this.done)return;let n=Math.round(Math.min(1,Math.max(0,e))*100);this.fill.style.width=`${n}%`,this.root.querySelector(`.loading__bar`)?.setAttribute(`aria-valuenow`,String(n)),this.status.textContent=t}finish(){this.done||(this.done=!0,this.fill.style.width=`100%`,this.status.textContent=`Ready`,requestAnimationFrame(()=>{this.root.classList.add(`loading--done`),window.setTimeout(()=>this.root.remove(),1e3)}))}};function At(e,t){if(document.querySelector(`.fatal:not(noscript .fatal)`)!==null)return;document.getElementById(`loading`)?.remove();let n=document.createElement(`div`);n.className=`fatal`;let r=document.createElement(`h2`);r.textContent=e;let i=document.createElement(`p`);i.textContent=t,n.append(r,i),document.body.appendChild(n)}var jt=class{cubeTarget;cubeCamera;pmrem;pmremTarget=null;nextFace=0;sweepDirty=!0;resolution;constructor(e,t){this.resolution=t,this.cubeTarget=Mt(t),this.cubeCamera=new ue(1,2e4,this.cubeTarget),this.cubeCamera.layers.set(1);for(let e of this.cubeCamera.children)e.layers.set(1);this.pmrem=new pe(e),this.pmrem.compileEquirectangularShader()}get texture(){return this.pmremTarget?.texture??null}get cubeTexture(){return this.cubeTarget.texture}invalidate(){this.sweepDirty=!0,this.nextFace=0}setResolution(e,t){t!==this.resolution&&(this.resolution=t,this.cubeTarget.dispose(),this.cubeTarget=Mt(t),this.cubeCamera.renderTarget=this.cubeTarget,this.invalidate())}update(e,t,n){let r=e.getRenderTarget(),i=e.xr.enabled;e.xr.enabled=!1;let a=Math.max(1,Math.min(6,n));for(let n=0;n<a;n+=1){let n=this.cubeCamera.children[this.nextFace];n!==void 0&&(e.setRenderTarget(this.cubeTarget,this.nextFace),e.clear(),e.render(t,n)),this.nextFace+=1,this.nextFace>=6&&(this.nextFace=0,this.sweepDirty=!0)}if(e.setRenderTarget(r),e.xr.enabled=i,!this.sweepDirty)return!1;this.sweepDirty=!1;let o=this.pmrem.fromCubemap(this.cubeTarget.texture,this.pmremTarget??void 0);return this.pmremTarget=o,!0}dispose(){this.cubeTarget.dispose(),this.pmremTarget?.dispose(),this.pmrem.dispose()}};function Mt(e){return new oe(e,{type:E,minFilter:d,magFilter:I,generateMipmaps:!0,depthBuffer:!1,stencilBuffer:!1})}var Nt=class{scene=new Oe;camera=new A(-1,1,1,-1,0,1);mesh;geometry;constructor(){this.geometry=new L,this.geometry.setAttribute(`position`,new j(new Float32Array([-1,-1,0,3,-1,0,-1,3,0]),3)),this.geometry.setAttribute(`uv`,new j(new Float32Array([0,0,2,0,0,2]),2)),this.mesh=new e(this.geometry),this.mesh.frustumCulled=!1,this.scene.add(this.mesh)}render(e,t,n){let r=e.getRenderTarget(),i=e.autoClear;this.mesh.material=t,e.setRenderTarget(n),e.autoClear=!0,e.render(this.scene,this.camera),e.autoClear=i,e.setRenderTarget(r)}dispose(){this.geometry.dispose(),this.scene.clear()}},Pt=`varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`,Ft=`precision highp float;

#ifndef ENDLESS_FISHING_ATMOSPHERE
#define ENDLESS_FISHING_ATMOSPHERE

#ifndef ENDLESS_FISHING_CONSTANTS\r
#define ENDLESS_FISHING_CONSTANTS

const float PI = 3.14159265358979323846;\r
const float TWO_PI = 6.28318530717958647692;\r
const float HALF_PI = 1.57079632679489661923;\r
const float INV_PI = 0.31830988618379067154;\r
const float INV_FOUR_PI = 0.07957747154594766788;\r
const float DEG_TO_RAD = 0.01745329251994329577;\r
const float RAD_TO_DEG = 57.2957795130823208768;

const float EPS = 1e-6;

#ifndef saturate\r
float saturate(float x) { return clamp(x, 0.0, 1.0); }\r
vec2 saturate(vec2 x) { return clamp(x, 0.0, 1.0); }\r
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }\r
#endif

float ef_luminance(vec3 colour) {\r
  return dot(colour, vec3(0.2126, 0.7152, 0.0722));\r
}

float remap(float x, float lowIn, float highIn, float lowOut, float highOut) {\r
  float span = highIn - lowIn;\r
  float t = span == 0.0 ? step(lowIn, x) : (x - lowIn) / span;\r
  return lowOut + saturate(t) * (highOut - lowOut);\r
}

vec3 hdrClamp(vec3 colour) {\r
  vec3 safe;\r
  safe.x = colour.x == colour.x ? colour.x : 0.0;\r
  safe.y = colour.y == colour.y ? colour.y : 0.0;\r
  safe.z = colour.z == colour.z ? colour.z : 0.0;\r
  
  
  return clamp(safe, vec3(0.0), vec3(60000.0));\r
}

float hdrClampAlpha(float alpha) {\r
  return clamp(alpha == alpha ? alpha : 0.0, 0.0, 1.0);\r
}

#endif

const float GROUND_RADIUS = 6360.0;
const float ATMOSPHERE_RADIUS = 6460.0;

const vec3 RAYLEIGH_SCATTERING = vec3(5.802, 13.558, 33.100) * 1e-3;
const float RAYLEIGH_SCALE_HEIGHT = 8.0;

const float MIE_SCATTERING = 3.996e-3;
const float MIE_EXTINCTION = 4.400e-3;
const float MIE_SCALE_HEIGHT = 1.2;

const float MIE_ASYMMETRY = 0.8;

const vec3 OZONE_ABSORPTION = vec3(0.650, 1.881, 0.085) * 1e-3;
const float OZONE_CENTRE = 25.0;
const float OZONE_HALF_WIDTH = 15.0;

const vec3 GROUND_ALBEDO = vec3(0.06, 0.07, 0.08);

struct MediumSample {
  vec3 scattering;   
  vec3 extinction;   
  vec3 rayleigh;     
  float mie;         
};

MediumSample sampleMedium(float radius) {
  float altitude = max(0.0, radius - GROUND_RADIUS);

  float rayleighDensity = exp(-altitude / RAYLEIGH_SCALE_HEIGHT);
  float mieDensity = exp(-altitude / MIE_SCALE_HEIGHT);
  float ozoneDensity = max(0.0, 1.0 - abs(altitude - OZONE_CENTRE) / OZONE_HALF_WIDTH);

  MediumSample medium;
  medium.rayleigh = RAYLEIGH_SCATTERING * rayleighDensity;
  medium.mie = MIE_SCATTERING * mieDensity;
  medium.scattering = medium.rayleigh + vec3(medium.mie);
  medium.extinction =
      medium.rayleigh + vec3(MIE_EXTINCTION * mieDensity) + OZONE_ABSORPTION * ozoneDensity;
  return medium;
}

float rayleighPhase(float cosTheta) {
  return 3.0 / (16.0 * PI) * (1.0 + cosTheta * cosTheta);
}

float miePhase(float cosTheta, float g) {
  float g2 = g * g;
  float numerator = 3.0 * (1.0 - g2) * (1.0 + cosTheta * cosTheta);
  float denominator = 8.0 * PI * (2.0 + g2) * pow(max(0.0, 1.0 + g2 - 2.0 * g * cosTheta), 1.5);
  return numerator / denominator;
}

float raySphereIntersect(vec3 origin, vec3 direction, float radius) {
  float b = dot(origin, direction);
  float c = dot(origin, origin) - radius * radius;
  if (c > 0.0 && b > 0.0) return -1.0;
  float discriminant = b * b - c;
  if (discriminant < 0.0) return -1.0;
  float sqrtDiscriminant = sqrt(discriminant);
  float near = -b - sqrtDiscriminant;
  float far = -b + sqrtDiscriminant;
  return near < 0.0 ? far : near;
}

bool intersectsGround(vec3 origin, vec3 direction) {
  return raySphereIntersect(origin, direction, GROUND_RADIUS) > 0.0;
}

vec2 transmittanceUv(float radius, float cosSunZenith) {
  float h = sqrt(max(0.0, ATMOSPHERE_RADIUS * ATMOSPHERE_RADIUS - GROUND_RADIUS * GROUND_RADIUS));
  float rho = sqrt(max(0.0, radius * radius - GROUND_RADIUS * GROUND_RADIUS));

  float discriminant =
      radius * radius * (cosSunZenith * cosSunZenith - 1.0) +
      ATMOSPHERE_RADIUS * ATMOSPHERE_RADIUS;
  float d = max(0.0, -radius * cosSunZenith + sqrt(max(0.0, discriminant)));

  float dMin = ATMOSPHERE_RADIUS - radius;
  float dMax = rho + h;
  return vec2((d - dMin) / max(EPS, dMax - dMin), rho / max(EPS, h));
}

void transmittanceParams(vec2 uv, out float radius, out float cosSunZenith) {
  float h = sqrt(max(0.0, ATMOSPHERE_RADIUS * ATMOSPHERE_RADIUS - GROUND_RADIUS * GROUND_RADIUS));
  float rho = h * uv.y;
  radius = sqrt(rho * rho + GROUND_RADIUS * GROUND_RADIUS);

  float dMin = ATMOSPHERE_RADIUS - radius;
  float dMax = rho + h;
  float d = dMin + uv.x * (dMax - dMin);
  cosSunZenith = d == 0.0
      ? 1.0
      : (h * h - rho * rho - d * d) / (2.0 * radius * d);
  cosSunZenith = clamp(cosSunZenith, -1.0, 1.0);
}

vec3 sampleTransmittance(sampler2D lut, float radius, float cosSunZenith) {
  return texture2DLodEXT(lut, transmittanceUv(radius, cosSunZenith), 0.0).rgb;
}

vec3 computeTransmittance(float radius, float cosSunZenith, int steps) {
  vec3 origin = vec3(0.0, radius, 0.0);
  vec3 direction = vec3(sqrt(max(0.0, 1.0 - cosSunZenith * cosSunZenith)), cosSunZenith, 0.0);

  float distanceToTop = raySphereIntersect(origin, direction, ATMOSPHERE_RADIUS);
  if (distanceToTop < 0.0) return vec3(1.0);

  float stepSize = distanceToTop / float(steps);
  vec3 opticalDepth = vec3(0.0);
  for (int i = 0; i < steps; i++) {
    
    float t = (float(i) + 0.5) * stepSize;
    MediumSample medium = sampleMedium(length(origin + direction * t));
    opticalDepth += medium.extinction * stepSize;
  }
  return exp(-opticalDepth);
}

vec2 skyViewUv(float radius, float cosViewZenith, float azimuth, bool hitsGround) {
  float horizonCos = sqrt(max(0.0, radius * radius - GROUND_RADIUS * GROUND_RADIUS)) / radius;
  float horizonAngle = acos(clamp(horizonCos, -1.0, 1.0));
  float viewZenithAngle = acos(clamp(cosViewZenith, -1.0, 1.0));
  
  float angleFromHorizon = horizonAngle - viewZenithAngle;

  float v;
  if (!hitsGround) {
    float t = sqrt(max(0.0, angleFromHorizon / max(EPS, horizonAngle)));
    v = 0.5 + 0.5 * t;
  } else {
    float t = sqrt(max(0.0, -angleFromHorizon / max(EPS, PI - horizonAngle)));
    v = 0.5 - 0.5 * t;
  }
  return vec2(azimuth / TWO_PI, clamp(v, 0.0, 1.0));
}

void skyViewParams(
    vec2 uv, float radius, out float cosViewZenith, out float azimuth, out bool hitsGround) {
  float horizonCos = sqrt(max(0.0, radius * radius - GROUND_RADIUS * GROUND_RADIUS)) / radius;
  float horizonAngle = acos(clamp(horizonCos, -1.0, 1.0));

  float viewZenithAngle;
  if (uv.y > 0.5) {
    float t = (uv.y - 0.5) * 2.0;
    viewZenithAngle = horizonAngle - t * t * horizonAngle;
    hitsGround = false;
  } else {
    float t = (0.5 - uv.y) * 2.0;
    viewZenithAngle = horizonAngle + t * t * (PI - horizonAngle);
    hitsGround = true;
  }
  cosViewZenith = cos(viewZenithAngle);
  azimuth = uv.x * TWO_PI;
}

#endif

varying vec2 vUv;

const int STEPS = 40;

void main() {
  float radius;
  float cosSunZenith;
  transmittanceParams(vUv, radius, cosSunZenith);
  gl_FragColor = vec4(computeTransmittance(radius, cosSunZenith, STEPS), 1.0);
}`,It=`precision highp float;

#ifndef ENDLESS_FISHING_ATMOSPHERE
#define ENDLESS_FISHING_ATMOSPHERE

#ifndef ENDLESS_FISHING_CONSTANTS\r
#define ENDLESS_FISHING_CONSTANTS

const float PI = 3.14159265358979323846;\r
const float TWO_PI = 6.28318530717958647692;\r
const float HALF_PI = 1.57079632679489661923;\r
const float INV_PI = 0.31830988618379067154;\r
const float INV_FOUR_PI = 0.07957747154594766788;\r
const float DEG_TO_RAD = 0.01745329251994329577;\r
const float RAD_TO_DEG = 57.2957795130823208768;

const float EPS = 1e-6;

#ifndef saturate\r
float saturate(float x) { return clamp(x, 0.0, 1.0); }\r
vec2 saturate(vec2 x) { return clamp(x, 0.0, 1.0); }\r
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }\r
#endif

float ef_luminance(vec3 colour) {\r
  return dot(colour, vec3(0.2126, 0.7152, 0.0722));\r
}

float remap(float x, float lowIn, float highIn, float lowOut, float highOut) {\r
  float span = highIn - lowIn;\r
  float t = span == 0.0 ? step(lowIn, x) : (x - lowIn) / span;\r
  return lowOut + saturate(t) * (highOut - lowOut);\r
}

vec3 hdrClamp(vec3 colour) {\r
  vec3 safe;\r
  safe.x = colour.x == colour.x ? colour.x : 0.0;\r
  safe.y = colour.y == colour.y ? colour.y : 0.0;\r
  safe.z = colour.z == colour.z ? colour.z : 0.0;\r
  
  
  return clamp(safe, vec3(0.0), vec3(60000.0));\r
}

float hdrClampAlpha(float alpha) {\r
  return clamp(alpha == alpha ? alpha : 0.0, 0.0, 1.0);\r
}

#endif

const float GROUND_RADIUS = 6360.0;
const float ATMOSPHERE_RADIUS = 6460.0;

const vec3 RAYLEIGH_SCATTERING = vec3(5.802, 13.558, 33.100) * 1e-3;
const float RAYLEIGH_SCALE_HEIGHT = 8.0;

const float MIE_SCATTERING = 3.996e-3;
const float MIE_EXTINCTION = 4.400e-3;
const float MIE_SCALE_HEIGHT = 1.2;

const float MIE_ASYMMETRY = 0.8;

const vec3 OZONE_ABSORPTION = vec3(0.650, 1.881, 0.085) * 1e-3;
const float OZONE_CENTRE = 25.0;
const float OZONE_HALF_WIDTH = 15.0;

const vec3 GROUND_ALBEDO = vec3(0.06, 0.07, 0.08);

struct MediumSample {
  vec3 scattering;   
  vec3 extinction;   
  vec3 rayleigh;     
  float mie;         
};

MediumSample sampleMedium(float radius) {
  float altitude = max(0.0, radius - GROUND_RADIUS);

  float rayleighDensity = exp(-altitude / RAYLEIGH_SCALE_HEIGHT);
  float mieDensity = exp(-altitude / MIE_SCALE_HEIGHT);
  float ozoneDensity = max(0.0, 1.0 - abs(altitude - OZONE_CENTRE) / OZONE_HALF_WIDTH);

  MediumSample medium;
  medium.rayleigh = RAYLEIGH_SCATTERING * rayleighDensity;
  medium.mie = MIE_SCATTERING * mieDensity;
  medium.scattering = medium.rayleigh + vec3(medium.mie);
  medium.extinction =
      medium.rayleigh + vec3(MIE_EXTINCTION * mieDensity) + OZONE_ABSORPTION * ozoneDensity;
  return medium;
}

float rayleighPhase(float cosTheta) {
  return 3.0 / (16.0 * PI) * (1.0 + cosTheta * cosTheta);
}

float miePhase(float cosTheta, float g) {
  float g2 = g * g;
  float numerator = 3.0 * (1.0 - g2) * (1.0 + cosTheta * cosTheta);
  float denominator = 8.0 * PI * (2.0 + g2) * pow(max(0.0, 1.0 + g2 - 2.0 * g * cosTheta), 1.5);
  return numerator / denominator;
}

float raySphereIntersect(vec3 origin, vec3 direction, float radius) {
  float b = dot(origin, direction);
  float c = dot(origin, origin) - radius * radius;
  if (c > 0.0 && b > 0.0) return -1.0;
  float discriminant = b * b - c;
  if (discriminant < 0.0) return -1.0;
  float sqrtDiscriminant = sqrt(discriminant);
  float near = -b - sqrtDiscriminant;
  float far = -b + sqrtDiscriminant;
  return near < 0.0 ? far : near;
}

bool intersectsGround(vec3 origin, vec3 direction) {
  return raySphereIntersect(origin, direction, GROUND_RADIUS) > 0.0;
}

vec2 transmittanceUv(float radius, float cosSunZenith) {
  float h = sqrt(max(0.0, ATMOSPHERE_RADIUS * ATMOSPHERE_RADIUS - GROUND_RADIUS * GROUND_RADIUS));
  float rho = sqrt(max(0.0, radius * radius - GROUND_RADIUS * GROUND_RADIUS));

  float discriminant =
      radius * radius * (cosSunZenith * cosSunZenith - 1.0) +
      ATMOSPHERE_RADIUS * ATMOSPHERE_RADIUS;
  float d = max(0.0, -radius * cosSunZenith + sqrt(max(0.0, discriminant)));

  float dMin = ATMOSPHERE_RADIUS - radius;
  float dMax = rho + h;
  return vec2((d - dMin) / max(EPS, dMax - dMin), rho / max(EPS, h));
}

void transmittanceParams(vec2 uv, out float radius, out float cosSunZenith) {
  float h = sqrt(max(0.0, ATMOSPHERE_RADIUS * ATMOSPHERE_RADIUS - GROUND_RADIUS * GROUND_RADIUS));
  float rho = h * uv.y;
  radius = sqrt(rho * rho + GROUND_RADIUS * GROUND_RADIUS);

  float dMin = ATMOSPHERE_RADIUS - radius;
  float dMax = rho + h;
  float d = dMin + uv.x * (dMax - dMin);
  cosSunZenith = d == 0.0
      ? 1.0
      : (h * h - rho * rho - d * d) / (2.0 * radius * d);
  cosSunZenith = clamp(cosSunZenith, -1.0, 1.0);
}

vec3 sampleTransmittance(sampler2D lut, float radius, float cosSunZenith) {
  return texture2DLodEXT(lut, transmittanceUv(radius, cosSunZenith), 0.0).rgb;
}

vec3 computeTransmittance(float radius, float cosSunZenith, int steps) {
  vec3 origin = vec3(0.0, radius, 0.0);
  vec3 direction = vec3(sqrt(max(0.0, 1.0 - cosSunZenith * cosSunZenith)), cosSunZenith, 0.0);

  float distanceToTop = raySphereIntersect(origin, direction, ATMOSPHERE_RADIUS);
  if (distanceToTop < 0.0) return vec3(1.0);

  float stepSize = distanceToTop / float(steps);
  vec3 opticalDepth = vec3(0.0);
  for (int i = 0; i < steps; i++) {
    
    float t = (float(i) + 0.5) * stepSize;
    MediumSample medium = sampleMedium(length(origin + direction * t));
    opticalDepth += medium.extinction * stepSize;
  }
  return exp(-opticalDepth);
}

vec2 skyViewUv(float radius, float cosViewZenith, float azimuth, bool hitsGround) {
  float horizonCos = sqrt(max(0.0, radius * radius - GROUND_RADIUS * GROUND_RADIUS)) / radius;
  float horizonAngle = acos(clamp(horizonCos, -1.0, 1.0));
  float viewZenithAngle = acos(clamp(cosViewZenith, -1.0, 1.0));
  
  float angleFromHorizon = horizonAngle - viewZenithAngle;

  float v;
  if (!hitsGround) {
    float t = sqrt(max(0.0, angleFromHorizon / max(EPS, horizonAngle)));
    v = 0.5 + 0.5 * t;
  } else {
    float t = sqrt(max(0.0, -angleFromHorizon / max(EPS, PI - horizonAngle)));
    v = 0.5 - 0.5 * t;
  }
  return vec2(azimuth / TWO_PI, clamp(v, 0.0, 1.0));
}

void skyViewParams(
    vec2 uv, float radius, out float cosViewZenith, out float azimuth, out bool hitsGround) {
  float horizonCos = sqrt(max(0.0, radius * radius - GROUND_RADIUS * GROUND_RADIUS)) / radius;
  float horizonAngle = acos(clamp(horizonCos, -1.0, 1.0));

  float viewZenithAngle;
  if (uv.y > 0.5) {
    float t = (uv.y - 0.5) * 2.0;
    viewZenithAngle = horizonAngle - t * t * horizonAngle;
    hitsGround = false;
  } else {
    float t = (0.5 - uv.y) * 2.0;
    viewZenithAngle = horizonAngle + t * t * (PI - horizonAngle);
    hitsGround = true;
  }
  cosViewZenith = cos(viewZenithAngle);
  azimuth = uv.x * TWO_PI;
}

#endif

varying vec2 vUv;

uniform sampler2D uTransmittanceLut;

const int SQRT_SAMPLES = 8;
const int STEPS = 20;

void integrateDirection(
    vec3 origin,
    vec3 direction,
    vec3 sunDirection,
    out vec3 secondOrder,
    out vec3 scatteredFraction) {
  secondOrder = vec3(0.0);
  scatteredFraction = vec3(0.0);

  float distanceToGround = raySphereIntersect(origin, direction, GROUND_RADIUS);
  float distanceToTop = raySphereIntersect(origin, direction, ATMOSPHERE_RADIUS);
  float maxDistance = distanceToGround > 0.0 ? distanceToGround : distanceToTop;
  if (maxDistance <= 0.0) return;

  float stepSize = maxDistance / float(STEPS);
  vec3 throughput = vec3(1.0);

  for (int i = 0; i < STEPS; i++) {
    vec3 position = origin + direction * ((float(i) + 0.5) * stepSize);
    float radius = length(position);
    MediumSample medium = sampleMedium(radius);

    vec3 stepTransmittance = exp(-medium.extinction * stepSize);
    vec3 sunTransmittance =
        sampleTransmittance(uTransmittanceLut, radius, dot(normalize(position), sunDirection));

    
    float sunVisibility = intersectsGround(position, sunDirection) ? 0.0 : 1.0;

    
    
    
    vec3 integratedScattering =
        (medium.scattering - medium.scattering * stepTransmittance) /
        max(vec3(EPS), medium.extinction);

    
    secondOrder += throughput * sunTransmittance * sunVisibility * integratedScattering * INV_FOUR_PI;
    
    scatteredFraction += throughput * integratedScattering;

    throughput *= stepTransmittance;
  }

  
  if (distanceToGround > 0.0) {
    vec3 groundPoint = origin + direction * distanceToGround;
    vec3 groundNormal = normalize(groundPoint);
    float cosSun = dot(groundNormal, sunDirection);
    if (cosSun > 0.0) {
      vec3 groundTransmittance =
          sampleTransmittance(uTransmittanceLut, GROUND_RADIUS, cosSun);
      secondOrder += throughput * groundTransmittance * cosSun * GROUND_ALBEDO * INV_PI;
    }
  }
}

void main() {
  
  
  float cosSunZenith = vUv.x * 2.0 - 1.0;
  float radius = mix(GROUND_RADIUS, ATMOSPHERE_RADIUS, vUv.y);

  vec3 origin = vec3(0.0, radius, 0.0);
  vec3 sunDirection = normalize(
      vec3(sqrt(max(0.0, 1.0 - cosSunZenith * cosSunZenith)), cosSunZenith, 0.0));

  vec3 secondOrderSum = vec3(0.0);
  vec3 scatteredFractionSum = vec3(0.0);

  for (int y = 0; y < SQRT_SAMPLES; y++) {
    for (int x = 0; x < SQRT_SAMPLES; x++) {
      
      float u = (float(x) + 0.5) / float(SQRT_SAMPLES);
      float v = (float(y) + 0.5) / float(SQRT_SAMPLES);
      float cosTheta = 1.0 - 2.0 * v;
      float sinTheta = sqrt(max(0.0, 1.0 - cosTheta * cosTheta));
      float phi = u * TWO_PI;
      vec3 direction = vec3(sinTheta * cos(phi), cosTheta, sinTheta * sin(phi));

      vec3 secondOrder;
      vec3 scatteredFraction;
      integrateDirection(origin, direction, sunDirection, secondOrder, scatteredFraction);
      secondOrderSum += secondOrder;
      scatteredFractionSum += scatteredFraction;
    }
  }

  float sampleCount = float(SQRT_SAMPLES * SQRT_SAMPLES);
  vec3 secondOrder = secondOrderSum / sampleCount;
  vec3 scatteredFraction = scatteredFractionSum / sampleCount;

  
  
  vec3 series = 1.0 / max(vec3(EPS), 1.0 - min(scatteredFraction, vec3(0.999)));
  gl_FragColor = vec4(secondOrder * series, 1.0);
}`,Lt=`precision highp float;

#ifndef ENDLESS_FISHING_ATMOSPHERE
#define ENDLESS_FISHING_ATMOSPHERE

#ifndef ENDLESS_FISHING_CONSTANTS\r
#define ENDLESS_FISHING_CONSTANTS

const float PI = 3.14159265358979323846;\r
const float TWO_PI = 6.28318530717958647692;\r
const float HALF_PI = 1.57079632679489661923;\r
const float INV_PI = 0.31830988618379067154;\r
const float INV_FOUR_PI = 0.07957747154594766788;\r
const float DEG_TO_RAD = 0.01745329251994329577;\r
const float RAD_TO_DEG = 57.2957795130823208768;

const float EPS = 1e-6;

#ifndef saturate\r
float saturate(float x) { return clamp(x, 0.0, 1.0); }\r
vec2 saturate(vec2 x) { return clamp(x, 0.0, 1.0); }\r
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }\r
#endif

float ef_luminance(vec3 colour) {\r
  return dot(colour, vec3(0.2126, 0.7152, 0.0722));\r
}

float remap(float x, float lowIn, float highIn, float lowOut, float highOut) {\r
  float span = highIn - lowIn;\r
  float t = span == 0.0 ? step(lowIn, x) : (x - lowIn) / span;\r
  return lowOut + saturate(t) * (highOut - lowOut);\r
}

vec3 hdrClamp(vec3 colour) {\r
  vec3 safe;\r
  safe.x = colour.x == colour.x ? colour.x : 0.0;\r
  safe.y = colour.y == colour.y ? colour.y : 0.0;\r
  safe.z = colour.z == colour.z ? colour.z : 0.0;\r
  
  
  return clamp(safe, vec3(0.0), vec3(60000.0));\r
}

float hdrClampAlpha(float alpha) {\r
  return clamp(alpha == alpha ? alpha : 0.0, 0.0, 1.0);\r
}

#endif

const float GROUND_RADIUS = 6360.0;
const float ATMOSPHERE_RADIUS = 6460.0;

const vec3 RAYLEIGH_SCATTERING = vec3(5.802, 13.558, 33.100) * 1e-3;
const float RAYLEIGH_SCALE_HEIGHT = 8.0;

const float MIE_SCATTERING = 3.996e-3;
const float MIE_EXTINCTION = 4.400e-3;
const float MIE_SCALE_HEIGHT = 1.2;

const float MIE_ASYMMETRY = 0.8;

const vec3 OZONE_ABSORPTION = vec3(0.650, 1.881, 0.085) * 1e-3;
const float OZONE_CENTRE = 25.0;
const float OZONE_HALF_WIDTH = 15.0;

const vec3 GROUND_ALBEDO = vec3(0.06, 0.07, 0.08);

struct MediumSample {
  vec3 scattering;   
  vec3 extinction;   
  vec3 rayleigh;     
  float mie;         
};

MediumSample sampleMedium(float radius) {
  float altitude = max(0.0, radius - GROUND_RADIUS);

  float rayleighDensity = exp(-altitude / RAYLEIGH_SCALE_HEIGHT);
  float mieDensity = exp(-altitude / MIE_SCALE_HEIGHT);
  float ozoneDensity = max(0.0, 1.0 - abs(altitude - OZONE_CENTRE) / OZONE_HALF_WIDTH);

  MediumSample medium;
  medium.rayleigh = RAYLEIGH_SCATTERING * rayleighDensity;
  medium.mie = MIE_SCATTERING * mieDensity;
  medium.scattering = medium.rayleigh + vec3(medium.mie);
  medium.extinction =
      medium.rayleigh + vec3(MIE_EXTINCTION * mieDensity) + OZONE_ABSORPTION * ozoneDensity;
  return medium;
}

float rayleighPhase(float cosTheta) {
  return 3.0 / (16.0 * PI) * (1.0 + cosTheta * cosTheta);
}

float miePhase(float cosTheta, float g) {
  float g2 = g * g;
  float numerator = 3.0 * (1.0 - g2) * (1.0 + cosTheta * cosTheta);
  float denominator = 8.0 * PI * (2.0 + g2) * pow(max(0.0, 1.0 + g2 - 2.0 * g * cosTheta), 1.5);
  return numerator / denominator;
}

float raySphereIntersect(vec3 origin, vec3 direction, float radius) {
  float b = dot(origin, direction);
  float c = dot(origin, origin) - radius * radius;
  if (c > 0.0 && b > 0.0) return -1.0;
  float discriminant = b * b - c;
  if (discriminant < 0.0) return -1.0;
  float sqrtDiscriminant = sqrt(discriminant);
  float near = -b - sqrtDiscriminant;
  float far = -b + sqrtDiscriminant;
  return near < 0.0 ? far : near;
}

bool intersectsGround(vec3 origin, vec3 direction) {
  return raySphereIntersect(origin, direction, GROUND_RADIUS) > 0.0;
}

vec2 transmittanceUv(float radius, float cosSunZenith) {
  float h = sqrt(max(0.0, ATMOSPHERE_RADIUS * ATMOSPHERE_RADIUS - GROUND_RADIUS * GROUND_RADIUS));
  float rho = sqrt(max(0.0, radius * radius - GROUND_RADIUS * GROUND_RADIUS));

  float discriminant =
      radius * radius * (cosSunZenith * cosSunZenith - 1.0) +
      ATMOSPHERE_RADIUS * ATMOSPHERE_RADIUS;
  float d = max(0.0, -radius * cosSunZenith + sqrt(max(0.0, discriminant)));

  float dMin = ATMOSPHERE_RADIUS - radius;
  float dMax = rho + h;
  return vec2((d - dMin) / max(EPS, dMax - dMin), rho / max(EPS, h));
}

void transmittanceParams(vec2 uv, out float radius, out float cosSunZenith) {
  float h = sqrt(max(0.0, ATMOSPHERE_RADIUS * ATMOSPHERE_RADIUS - GROUND_RADIUS * GROUND_RADIUS));
  float rho = h * uv.y;
  radius = sqrt(rho * rho + GROUND_RADIUS * GROUND_RADIUS);

  float dMin = ATMOSPHERE_RADIUS - radius;
  float dMax = rho + h;
  float d = dMin + uv.x * (dMax - dMin);
  cosSunZenith = d == 0.0
      ? 1.0
      : (h * h - rho * rho - d * d) / (2.0 * radius * d);
  cosSunZenith = clamp(cosSunZenith, -1.0, 1.0);
}

vec3 sampleTransmittance(sampler2D lut, float radius, float cosSunZenith) {
  return texture2DLodEXT(lut, transmittanceUv(radius, cosSunZenith), 0.0).rgb;
}

vec3 computeTransmittance(float radius, float cosSunZenith, int steps) {
  vec3 origin = vec3(0.0, radius, 0.0);
  vec3 direction = vec3(sqrt(max(0.0, 1.0 - cosSunZenith * cosSunZenith)), cosSunZenith, 0.0);

  float distanceToTop = raySphereIntersect(origin, direction, ATMOSPHERE_RADIUS);
  if (distanceToTop < 0.0) return vec3(1.0);

  float stepSize = distanceToTop / float(steps);
  vec3 opticalDepth = vec3(0.0);
  for (int i = 0; i < steps; i++) {
    
    float t = (float(i) + 0.5) * stepSize;
    MediumSample medium = sampleMedium(length(origin + direction * t));
    opticalDepth += medium.extinction * stepSize;
  }
  return exp(-opticalDepth);
}

vec2 skyViewUv(float radius, float cosViewZenith, float azimuth, bool hitsGround) {
  float horizonCos = sqrt(max(0.0, radius * radius - GROUND_RADIUS * GROUND_RADIUS)) / radius;
  float horizonAngle = acos(clamp(horizonCos, -1.0, 1.0));
  float viewZenithAngle = acos(clamp(cosViewZenith, -1.0, 1.0));
  
  float angleFromHorizon = horizonAngle - viewZenithAngle;

  float v;
  if (!hitsGround) {
    float t = sqrt(max(0.0, angleFromHorizon / max(EPS, horizonAngle)));
    v = 0.5 + 0.5 * t;
  } else {
    float t = sqrt(max(0.0, -angleFromHorizon / max(EPS, PI - horizonAngle)));
    v = 0.5 - 0.5 * t;
  }
  return vec2(azimuth / TWO_PI, clamp(v, 0.0, 1.0));
}

void skyViewParams(
    vec2 uv, float radius, out float cosViewZenith, out float azimuth, out bool hitsGround) {
  float horizonCos = sqrt(max(0.0, radius * radius - GROUND_RADIUS * GROUND_RADIUS)) / radius;
  float horizonAngle = acos(clamp(horizonCos, -1.0, 1.0));

  float viewZenithAngle;
  if (uv.y > 0.5) {
    float t = (uv.y - 0.5) * 2.0;
    viewZenithAngle = horizonAngle - t * t * horizonAngle;
    hitsGround = false;
  } else {
    float t = (0.5 - uv.y) * 2.0;
    viewZenithAngle = horizonAngle + t * t * (PI - horizonAngle);
    hitsGround = true;
  }
  cosViewZenith = cos(viewZenithAngle);
  azimuth = uv.x * TWO_PI;
}

#endif

varying vec2 vUv;

uniform sampler2D uTransmittanceLut;\r
uniform sampler2D uMultiScatterLut;

uniform vec3 uSunDirection;

uniform float uAltitudeKm;\r
uniform int uSteps;

vec3 sampleMultiScatter(float radius, float cosSunZenith) {\r
  vec2 uv = vec2(\r
      cosSunZenith * 0.5 + 0.5,\r
      clamp((radius - GROUND_RADIUS) / (ATMOSPHERE_RADIUS - GROUND_RADIUS), 0.0, 1.0));\r
  
  return texture2DLodEXT(uMultiScatterLut, uv, 0.0).rgb;\r
}\r

float sunElevationAbove(vec3 position, vec3 sunDirection) {\r
  float radius = length(position);\r
  float horizonCos =\r
      -sqrt(max(0.0, 1.0 - (GROUND_RADIUS * GROUND_RADIUS) / (radius * radius)));\r
  return dot(position / radius, sunDirection) - horizonCos;\r
}\r

float sunlitFraction(vec3 start, vec3 end, vec3 sunDirection) {\r
  float a = sunElevationAbove(start, sunDirection);\r
  float b = sunElevationAbove(end, sunDirection);\r
  float delta = b - a;\r
  
  if (abs(delta) < 1e-9) return a >= 0.0 ? 1.0 : 0.0;\r
  float crossing = clamp(-a / delta, 0.0, 1.0);\r
  return delta > 0.0 ? 1.0 - crossing : crossing;\r
}

void main() {\r
  float radius = GROUND_RADIUS + max(0.0, uAltitudeKm);

  float cosViewZenith;\r
  float azimuth;\r
  bool hitsGround;\r
  skyViewParams(vUv, radius, cosViewZenith, azimuth, hitsGround);

  float sinViewZenith = sqrt(max(0.0, 1.0 - cosViewZenith * cosViewZenith));\r
  vec3 viewDirection =\r
      vec3(sinViewZenith * sin(azimuth), cosViewZenith, -sinViewZenith * cos(azimuth));\r
  vec3 origin = vec3(0.0, radius, 0.0);

  float distanceToGround = raySphereIntersect(origin, viewDirection, GROUND_RADIUS);\r
  float distanceToTop = raySphereIntersect(origin, viewDirection, ATMOSPHERE_RADIUS);\r
  float maxDistance = distanceToGround > 0.0 ? distanceToGround : distanceToTop;\r
  if (maxDistance <= 0.0) {\r
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);\r
    return;\r
  }

  float cosSunView = dot(viewDirection, uSunDirection);\r
  float rayleighWeight = rayleighPhase(cosSunView);\r
  float mieWeight = miePhase(cosSunView, MIE_ASYMMETRY);

  vec3 luminance = vec3(0.0);\r
  vec3 throughput = vec3(1.0);

  float steps = float(uSteps);\r
  for (int i = 0; i < 64; i++) {\r
    if (i >= uSteps) break;

    
    
    float t0 = float(i) / steps;\r
    float t1 = float(i + 1) / steps;\r
    t0 *= t0;\r
    t1 *= t1;\r
    float segmentStart = t0 * maxDistance;\r
    float segmentEnd = min(t1 * maxDistance, maxDistance);\r
    float stepSize = segmentEnd - segmentStart;\r
    if (stepSize <= 0.0) continue;

    vec3 position = origin + viewDirection * (segmentStart + stepSize * 0.5);\r
    float sampleRadius = length(position);\r
    float sunVisibility = sunlitFraction(\r
        origin + viewDirection * segmentStart, origin + viewDirection * segmentEnd,\r
        uSunDirection);\r
    vec3 up = position / sampleRadius;\r
    float cosSunZenith = dot(up, uSunDirection);

    MediumSample medium = sampleMedium(sampleRadius);\r
    vec3 stepTransmittance = exp(-medium.extinction * stepSize);\r
    vec3 sunTransmittance = sampleTransmittance(uTransmittanceLut, sampleRadius, cosSunZenith);

    
    vec3 singleScatter =\r
        (medium.rayleigh * rayleighWeight + vec3(medium.mie * mieWeight)) *\r
        sunTransmittance * sunVisibility;\r
    vec3 multiScatter = medium.scattering * sampleMultiScatter(sampleRadius, cosSunZenith);

    vec3 inScatter = singleScatter + multiScatter;\r
    
    vec3 integrated =\r
        (inScatter - inScatter * stepTransmittance) / max(vec3(EPS), medium.extinction);

    luminance += throughput * integrated;\r
    throughput *= stepTransmittance;\r
  }

  
  if (distanceToGround > 0.0) {\r
    vec3 groundPoint = origin + viewDirection * distanceToGround;\r
    vec3 groundNormal = normalize(groundPoint);\r
    float cosSun = dot(groundNormal, uSunDirection);\r
    if (cosSun > 0.0) {\r
      vec3 groundTransmittance = sampleTransmittance(uTransmittanceLut, GROUND_RADIUS, cosSun);\r
      luminance += throughput * groundTransmittance * cosSun * GROUND_ALBEDO * INV_PI;\r
    }\r
  }

  gl_FragColor = vec4(luminance, 1.0);\r
}`,Rt=256,zt=64,Bt=32,Vt=384,Ht=216,Ut=.15;function Wt(e,t,n){let r=new re(e,t,{type:E,minFilter:I,magFilter:I,depthBuffer:!1,stencilBuffer:!1,generateMipmaps:!1,colorSpace:``});return r.texture.wrapS=n,r.texture.wrapT=C,r}var Gt=class{pass=new Nt;transmittanceTarget;multiScatterTarget;skyViewTarget;texelBuffer=new Uint16Array(4);rowBuffer=new Uint16Array(Vt*4);transmittanceMaterial;multiScatterMaterial;skyViewMaterial;transmittanceBuilt=!1;lastSunAltitudeDeg=-1/0;lastAltitudeKm=-1/0;lastSteps=-1;localSun=new t;constructor(){this.transmittanceTarget=Wt(Rt,zt,C),this.multiScatterTarget=Wt(Bt,Bt,C),this.skyViewTarget=Wt(Vt,Ht,v),this.transmittanceMaterial=new i({vertexShader:Pt,fragmentShader:Ft,depthTest:!1,depthWrite:!1}),this.multiScatterMaterial=new i({vertexShader:Pt,fragmentShader:It,uniforms:{uTransmittanceLut:{value:this.transmittanceTarget.texture}},depthTest:!1,depthWrite:!1}),this.skyViewMaterial=new i({vertexShader:Pt,fragmentShader:Lt,uniforms:{uTransmittanceLut:{value:this.transmittanceTarget.texture},uMultiScatterLut:{value:this.multiScatterTarget.texture},uSunDirection:{value:new t(0,1,0)},uAltitudeKm:{value:0},uSteps:{value:32}},depthTest:!1,depthWrite:!1})}get transmittanceLut(){return this.transmittanceTarget.texture}get skyViewLut(){return this.skyViewTarget.texture}get multiScatterLut(){return this.multiScatterTarget.texture}update(e,t,n,r){this.transmittanceBuilt||(this.pass.render(e,this.transmittanceMaterial,this.transmittanceTarget),this.pass.render(e,this.multiScatterMaterial,this.multiScatterTarget),this.transmittanceBuilt=!0,this.lastSunAltitudeDeg=-1/0);let i=Math.max(8,Math.min(64,r)),a=Math.abs(t-this.lastSunAltitudeDeg)>=Ut,o=Math.abs(n-this.lastAltitudeKm)>=.002,s=i!==this.lastSteps;if(!a&&!o&&!s)return!1;this.lastSunAltitudeDeg=t,this.lastAltitudeKm=n,this.lastSteps=i;let c=t*Math.PI/180;this.localSun.set(0,Math.sin(c),-Math.cos(c)).normalize();let l=this.skyViewMaterial.uniforms,u=l.uSunDirection;u!==void 0&&(u.value=this.localSun);let d=l.uAltitudeKm;d!==void 0&&(d.value=n);let f=l.uSteps;return f!==void 0&&(f.value=i),this.pass.render(e,this.skyViewMaterial,this.skyViewTarget),!0}sampleSkyView(e,t,n){let r=Math.max(0,Math.min(383,Math.round(t*383))),i=Math.max(0,Math.min(215,Math.round(n*215)));return e.readRenderTargetPixels(this.skyViewTarget,r,i,1,1,this.texelBuffer),[o.fromHalfFloat(this.texelBuffer[0]??0),o.fromHalfFloat(this.texelBuffer[1]??0),o.fromHalfFloat(this.texelBuffer[2]??0)]}meanSkyViewRowLuminance(e,t){let n=Math.max(0,Math.min(215,Math.round(t*215)));e.readRenderTargetPixels(this.skyViewTarget,0,n,Vt,1,this.rowBuffer);let r=0;for(let e=0;e<Vt;e+=1){let t=o.fromHalfFloat(this.rowBuffer[e*4]??0),n=o.fromHalfFloat(this.rowBuffer[e*4+1]??0),i=o.fromHalfFloat(this.rowBuffer[e*4+2]??0);r+=Math.max(0,.2126*t+.7152*n+.0722*i)}return r/Vt}dispose(){this.transmittanceTarget.dispose(),this.multiScatterTarget.dispose(),this.skyViewTarget.dispose(),this.transmittanceMaterial.dispose(),this.multiScatterMaterial.dispose(),this.skyViewMaterial.dispose(),this.pass.dispose()}},Kt=2451545,qt=36525,Jt=864e5,z=Math.PI/180,Yt=180/Math.PI,Xt=Math.PI/648e3,Zt=[[1960,33.2],[1962,34],[1964,35],[1966,36.5],[1968,38.3],[1970,40.2],[1972,42.2],[1974,44.5],[1976,46.5],[1978,48.5],[1980,50.5],[1982,52.2],[1984,53.8],[1986,54.9],[1988,55.8],[1990,56.9],[1992,58.3],[1994,60],[1996,61.6],[1998,63],[2e3,63.8],[2002,64.3],[2004,64.6],[2006,64.8],[2008,65.5],[2010,66.1],[2012,66.7],[2014,67.3],[2016,68.1],[2018,68.9],[2020,69.4],[2022,69.3],[2024,69.2],[2026,69.2],[2028,69.3],[2030,69.5]];function Qt(e){let t=Zt[0],n=Zt[Zt.length-1];if(t===void 0||n===void 0)return 69;if(e>=t[0]&&e<=n[0])for(let t=0;t<Zt.length-1;t+=1){let n=Zt[t],r=Zt[t+1];if(n===void 0||r===void 0)break;if(e>=n[0]&&e<=r[0]){let t=(e-n[0])/(r[0]-n[0]);return n[1]+(r[1]-n[1])*t}}if(e>n[0]){if(e<=2150){let t=(e-1820)/100;return-20+32*t*t-.5628*(2150-e)}let t=(e-1820)/100;return-20+32*t*t}if(e>=1900){let t=(e-1900)/100;return(-2.79+1.494119*t-.0598939*t*t+.0061966*t**3-197e-6*t**4)*100}let r=(e-1820)/100;return-20+32*r*r}function $t(e){return e/Jt+2440587.5}function en(e){return 2e3+(e-Kt)/365.25}function tn(e){let t=$t(e),n=t+Qt(en(t))/86400;return{jd:t,jde:n,T:(n-Kt)/qt,epochMs:e}}function B(e){let t=e%360;return t<0?t+360:t}function nn(e){let t=Math.PI*2,n=e%t;return n<0?n+t:n}var V=e=>Math.sin(e*z),rn=e=>Math.cos(e*z);function an(e){let t=B(125.04452-1934.136261*e+.0020708*e*e+e*e*e/45e4),n=B(280.4665+36000.7698*e),r=B(218.3165+481267.8813*e),i=-17.2*V(t)-1.32*V(2*n)-.23*V(2*r)+.21*V(2*t),a=9.2*rn(t)+.57*rn(2*n)+.1*rn(2*r)-.09*rn(2*t),o=i*Xt,s=a*Xt,c=on(e);return{deltaPsi:o,deltaEpsilon:s,meanObliquity:c,trueObliquity:c+s}}function on(e){let t=e/100;return(23+(26+(21.448-4680.93*t-1.55*t**2+1999.25*t**3-51.38*t**4-249.67*t**5-39.05*t**6+7.12*t**7+27.87*t**8+5.79*t**9+2.45*t**10)/60)/60)*z}function sn(e,t){let n=Math.sin(e.longitude),r=Math.cos(e.longitude),i=Math.sin(e.latitude),a=Math.cos(e.latitude),o=Math.sin(t),s=Math.cos(t);return{rightAscension:nn(Math.atan2(n*s-i/a*o,r)),declination:Math.asin(i*s+a*o*n),distance:e.distance}}function cn(e,t,n){let r=n*z,i=Math.sin(r),a=Math.cos(r),o=Math.sin(e),s=Math.cos(e),c=Math.sin(t),l=Math.cos(t);return{altitude:Math.asin(i*o+a*s*l),azimuth:nn(Math.atan2(c,l*i-o/s*a)+Math.PI)}}192.85948*z,27.12825*z,122.93192*z;function ln(e,t,n,r){let i=n-e,a=Math.sin(t)*Math.sin(r)+Math.cos(t)*Math.cos(r)*Math.cos(i);if(a>.9999999){let e=Math.cos(r)*Math.sin(i),n=Math.cos(t)*Math.sin(r)-Math.sin(t)*Math.cos(r)*Math.cos(i),a=Math.sin(t)*Math.sin(r)+Math.cos(t)*Math.cos(r)*Math.cos(i);return Math.atan2(Math.hypot(e,n),a)}return Math.acos(Math.min(1,Math.max(-1,a)))}function un(e){let t=(e-Kt)/36525;return B(280.46061837+360.98564736629*(e-Kt)+387933e-9*t*t-t*t*t/3871e4)*z}function dn(e,t){let{deltaPsi:n,trueObliquity:r}=an(t);return nn(un(e)+n*Math.cos(r))}function fn(e,t,n){return nn(dn(e,t)+n*z)}function pn(e,t){let n=e-t,r=Math.PI*2;return n%=r,n>Math.PI&&(n-=r),n<=-Math.PI&&(n+=r),n}var mn=1010,hn={pressureMbar:mn,temperatureC:10};function gn(e){return e.pressureMbar/mn*(283/(273+e.temperatureC))}function _n(e,t=hn){let n=Math.max(e*Yt,-1.9),r=1.02/Math.tan((n+10.3/(n+5.11))*z);return Math.max(0,r)*gn(t)*(z/60)}function vn(e,t=hn){return e+_n(e,t)}function yn(e,t,n=hn){let r=vn(e+t,n)-vn(e-t,n);return Math.min(1,Math.max(.5,r/(2*t)))}var bn=Math.PI/648e3*959.63,xn=133e3;function Sn(e,t,n){let{T:r}=e,i=B(280.46646+r*(36000.76983+r*3032e-7)),a=B(357.52911+r*(35999.05029-1537e-7*r)),o=.016708634-r*(42037e-9+1.267e-7*r),s=V(a)*(1.914602-r*(.004817+14e-6*r))+V(2*a)*(.019993-101e-6*r)+V(3*a)*289e-6,c=i+s,l=a+s,u=1.000001018*(1-o*o)/(1+o*rn(l)),d=125.04-1934.136*r,f=nn((c-.00569-.00478*V(d))*z),{meanObliquity:p}=an(r),m=p+.00256*z*rn(d),h=Math.sin(f),g=Math.cos(f),_=nn(Math.atan2(Math.cos(m)*h,g)),v=Math.asin(Math.sin(m)*h),y=pn(fn(e.jd,r,t.longitudeDeg),_),b=cn(v,y,t.latitudeDeg),x=Math.tan(m/2)**2,S=x*V(2*i)-2*o*V(a)+4*o*x*V(a)*rn(2*i)-.5*x*x*V(4*i)-1.25*o*o*V(2*a);return{apparentLongitude:f,equatorial:{rightAscension:_,declination:v,distance:u},horizontal:b,apparentAltitude:vn(b.altitude,n),angularRadius:bn/u,distanceAu:u,equationOfTimeMinutes:S*4*180/Math.PI,hourAngle:y}}var Cn=-.833;function wn(e){return e>6?`day`:e>-.833?`golden-hour`:e>-6?`civil-twilight`:e>-12?`nautical-twilight`:e>-18?`astronomical-twilight`:`night`}function Tn(e,t){let n=e*180/Math.PI;if(n<-.9)return 0;let r=.7**(1/(Math.sin(e)+.50572*(n+6.07995)**-1.6364))**.678;return xn*(1/(t*t))*r*Math.max(0,Math.sin(e))}var En=5,Dn=[`clear`,`partly-cloudy`,`overcast`,`fog`,`storm`,`night`],On={clear:[`partly-cloudy`,`overcast`],"partly-cloudy":[`clear`,`overcast`],overcast:[`storm`,`partly-cloudy`],fog:[`overcast`,`partly-cloudy`],storm:[`overcast`,`partly-cloudy`],night:[`clear`,`partly-cloudy`]};function kn(e){return Dn.includes(e)}var An=class e{entries=[];byFamily=new Map;loaded=new Map;pending=new Set;resources;frame=0;constructor(e){this.resources=e}static async load(t){let n=new e(t),r=await t.loadBinary(`sky-library.json`),i=JSON.parse(new TextDecoder().decode(r));for(let e of i.skies){let t=kn(e.weather)?e.weather:`partly-cloudy`,r=Sn(tn(e.capturedAtMs),{latitudeDeg:e.latitudeDeg,longitudeDeg:e.longitudeDeg,elevationM:0});n.entries.push({slug:e.slug,file:e.file,weather:t,note:e.note,bakedSunAltitudeDeg:r.horizontal.altitude*Yt,bakedSunAzimuthDeg:r.horizontal.azimuth*Yt})}for(let e of Dn){let t=n.entries.filter(t=>t.weather===e).sort((e,t)=>e.bakedSunAltitudeDeg-t.bakedSunAltitudeDeg);t.length>0&&n.byFamily.set(e,t)}if(n.entries.length===0)throw Error("sky-library.json contained no usable skies — run `npm run assets`");return n}get all(){return this.entries}select(e,t){let n=t<-6?`night`:e,r=this.candidatesFor(n),i=r[0],a=r[r.length-1];if(i===void 0||a===void 0)throw Error(`No sky panoramas available for weather family "${n}"`);if(t<=i.bakedSunAltitudeDeg)return{a:i,b:i,blend:0};if(t>=a.bakedSunAltitudeDeg)return{a,b:a,blend:0};for(let e=0;e<r.length-1;e+=1){let n=r[e],i=r[e+1];if(n===void 0||i===void 0)break;if(t>=n.bakedSunAltitudeDeg&&t<=i.bakedSunAltitudeDeg){let e=i.bakedSunAltitudeDeg-n.bakedSunAltitudeDeg;return{a:n,b:i,blend:e<1e-4?0:(t-n.bakedSunAltitudeDeg)/e}}}return{a,b:a,blend:0}}rotationFor(e,t){return(t-e.bakedSunAzimuthDeg)*Math.PI/180}texture(e){let t=this.loaded.get(e.slug);if(t!==void 0)return t.lastUsedFrame=this.frame,t.texture;this.ensureLoaded(e)}inverseMeanLuminance(e){let t=this.loaded.get(e.slug);return t===void 0?1:1/Math.max(1e-4,t.meanLuminance)}async ensureLoaded(e){if(!(this.loaded.has(e.slug)||this.pending.has(e.slug))){this.pending.add(e.slug);try{let t=await this.resources.loadHDRI(e.file);this.loaded.set(e.slug,{texture:t,meanLuminance:jn(t),lastUsedFrame:this.frame}),this.evict()}finally{this.pending.delete(e.slug)}}}tick(){this.frame+=1}dispose(){for(let e of this.loaded.values())this.resources.untrack(e.texture),e.texture.dispose();this.loaded.clear()}candidatesFor(e){let t=this.byFamily.get(e);if(t!==void 0&&t.length>0)return t;for(let t of On[e]){let e=this.byFamily.get(t);if(e!==void 0&&e.length>0)return e}return this.entries}evict(){for(;this.loaded.size>En;){let e,t=1/0;for(let[n,r]of this.loaded)r.lastUsedFrame<t&&(t=r.lastUsedFrame,e=n);if(e===void 0)return;let n=this.loaded.get(e);n!==void 0&&(this.resources.untrack(n.texture),n.texture.dispose()),this.loaded.delete(e)}}};function jn(e){let t=e.image,{width:n,height:r}=t,i=t.data,a=i instanceof Uint16Array?e=>o.fromHalfFloat(i[e]??0):e=>i[e]??0,s=Math.max(1,Math.floor(Math.min(n,r)/96)),c=0,l=0;for(let e=0;e<r/2;e+=s){let t=(e+.5)/r*Math.PI,i=Math.sin(t);for(let t=0;t<n;t+=s){let r=(e*n+t)*4,o=a(r),s=a(r+1),u=a(r+2);c+=i*(.2126*o+.7152*s+.0722*u),l+=i}}return l===0?1:c/l}var Mn=1112752949,Nn=12,Pn=16;function Fn(e){let t=new DataView(e);if(e.byteLength<Pn)throw Error(`Star catalogue is truncated: no header`);let n=t.getUint32(0,!0);if(n!==Mn)throw Error(`Star catalogue has the wrong magic (0x${n.toString(16)}) — re-run \`npm run textures\``);let r=t.getUint32(8,!0),i=Pn+r*Nn;if(e.byteLength<i)throw Error(`Star catalogue is truncated: expected ${i} bytes for ${r} stars, got ${e.byteLength}`);let a=new Float32Array(r*3),o=new Float32Array(r),s=new Float32Array(r*3),c=1/0,l=-1/0;for(let e=0;e<r;e+=1){let n=Pn+e*Nn,r=t.getFloat32(n,!0),i=t.getFloat32(n+4,!0),u=t.getInt16(n+8,!0)/100,d=t.getInt16(n+10,!0)/100,f=Math.cos(i);a[e*3]=f*Math.cos(r),a[e*3+1]=f*Math.sin(r),a[e*3+2]=Math.sin(i),o[e]=u,c=Math.min(c,u),l=Math.max(l,u);let p=Ln(d);s[e*3]=p[0],s[e*3+1]=p[1],s[e*3+2]=p[2]}return{count:r,positions:a,magnitudes:o,colours:s,brightestMagnitude:c,faintestMagnitude:l}}function In(e){let t=Math.min(2.5,Math.max(-.4,e));return 4600*(1/(.92*t+1.7)+1/(.92*t+.62))}function Ln(e){let t=Math.min(25e3,Math.max(1667,In(e))),n=1e3/t,r;r=t<4e3?-.2661239*n**3-.234358*n**2+.8776956*n+.17991:-3.0258469*n**3+2.1070379*n**2+.2226347*n+.24039;let i;i=t<2222?-1.1063814*r**3-1.3481102*r**2+2.18555832*r-.20219683:t<4e3?-.9549476*r**3-1.37418593*r**2+2.09137015*r-.16748867:3.081758*r**3-5.8733867*r**2+3.75112997*r-.37001483;let a=r/Math.max(1e-6,i),o=(1-r-i)/Math.max(1e-6,i),s=3.2404542*a-1.5371385-.4985314*o,c=-.969266*a+1.8760108+.041556*o,l=.0556434*a-.2040259+1.0572252*o,u=Math.min(s,c,l);u<0&&(s-=u,c-=u,l-=u);let d=.2126*s+.7152*c+.0722*l;return d<=0?[1,1,1]:[s/d,c/d,l/d]}var Rn=`#ifndef ENDLESS_FISHING_CONSTANTS\r
#define ENDLESS_FISHING_CONSTANTS

const float PI = 3.14159265358979323846;\r
const float TWO_PI = 6.28318530717958647692;\r
const float HALF_PI = 1.57079632679489661923;\r
const float INV_PI = 0.31830988618379067154;\r
const float INV_FOUR_PI = 0.07957747154594766788;\r
const float DEG_TO_RAD = 0.01745329251994329577;\r
const float RAD_TO_DEG = 57.2957795130823208768;

const float EPS = 1e-6;

#ifndef saturate\r
float saturate(float x) { return clamp(x, 0.0, 1.0); }\r
vec2 saturate(vec2 x) { return clamp(x, 0.0, 1.0); }\r
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }\r
#endif

float ef_luminance(vec3 colour) {\r
  return dot(colour, vec3(0.2126, 0.7152, 0.0722));\r
}

float remap(float x, float lowIn, float highIn, float lowOut, float highOut) {\r
  float span = highIn - lowIn;\r
  float t = span == 0.0 ? step(lowIn, x) : (x - lowIn) / span;\r
  return lowOut + saturate(t) * (highOut - lowOut);\r
}

vec3 hdrClamp(vec3 colour) {\r
  vec3 safe;\r
  safe.x = colour.x == colour.x ? colour.x : 0.0;\r
  safe.y = colour.y == colour.y ? colour.y : 0.0;\r
  safe.z = colour.z == colour.z ? colour.z : 0.0;\r
  
  
  return clamp(safe, vec3(0.0), vec3(60000.0));\r
}

float hdrClampAlpha(float alpha) {\r
  return clamp(alpha == alpha ? alpha : 0.0, 0.0, 1.0);\r
}

#endif

attribute float aMagnitude;
attribute vec3 aColour;

varying vec3 vColour;
varying float vIntensity;

uniform float uPixelScale;

uniform float uNightFactor;

uniform float uTime;

uniform float uIntensity;

uniform float uMagnitudeLimit;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  
  
  
  vec3 direction = normalize(mat3(modelMatrix) * position);

  
  
  float flux = pow(10.0, -0.4 * aMagnitude);

  
  
  float altitude = direction.y;
  float airMass = 1.0 / max(0.05, altitude + 0.025 / (altitude + 0.04));
  float extinction = pow(10.0, -0.4 * 0.21 * airMass);

  
  
  float phase = hash11(aMagnitude * 977.0 + position.x * 131.0 + position.z * 71.0) * TWO_PI;
  float twinkle = 1.0 + (airMass - 1.0) * 0.09 *
      (sin(uTime * 6.1 + phase) + 0.7 * sin(uTime * 11.3 + phase * 1.7));

  float visible = step(aMagnitude, uMagnitudeLimit) * smoothstep(-0.03, 0.02, altitude);
  vIntensity = flux * extinction * twinkle * uNightFactor * uIntensity * visible;
  vColour = aColour;

  
  
  float size = uPixelScale * (0.55 + 1.35 * pow(flux, 0.25));

  vec4 mvPosition = viewMatrix * worldPosition;
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = clamp(size, 1.0, 9.0);
}`,zn=`precision highp float;

#ifndef ENDLESS_FISHING_CONSTANTS\r
#define ENDLESS_FISHING_CONSTANTS

const float PI = 3.14159265358979323846;\r
const float TWO_PI = 6.28318530717958647692;\r
const float HALF_PI = 1.57079632679489661923;\r
const float INV_PI = 0.31830988618379067154;\r
const float INV_FOUR_PI = 0.07957747154594766788;\r
const float DEG_TO_RAD = 0.01745329251994329577;\r
const float RAD_TO_DEG = 57.2957795130823208768;

const float EPS = 1e-6;

#ifndef saturate\r
float saturate(float x) { return clamp(x, 0.0, 1.0); }\r
vec2 saturate(vec2 x) { return clamp(x, 0.0, 1.0); }\r
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }\r
#endif

float ef_luminance(vec3 colour) {\r
  return dot(colour, vec3(0.2126, 0.7152, 0.0722));\r
}

float remap(float x, float lowIn, float highIn, float lowOut, float highOut) {\r
  float span = highIn - lowIn;\r
  float t = span == 0.0 ? step(lowIn, x) : (x - lowIn) / span;\r
  return lowOut + saturate(t) * (highOut - lowOut);\r
}

vec3 hdrClamp(vec3 colour) {\r
  vec3 safe;\r
  safe.x = colour.x == colour.x ? colour.x : 0.0;\r
  safe.y = colour.y == colour.y ? colour.y : 0.0;\r
  safe.z = colour.z == colour.z ? colour.z : 0.0;\r
  
  
  return clamp(safe, vec3(0.0), vec3(60000.0));\r
}

float hdrClampAlpha(float alpha) {\r
  return clamp(alpha == alpha ? alpha : 0.0, 0.0, 1.0);\r
}

#endif

varying vec3 vColour;
varying float vIntensity;

void main() {
  if (vIntensity <= 0.0) discard;

  vec2 offset = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(offset, offset);
  if (r2 > 1.0) discard;

  float core = exp(-r2 * 9.0);
  float halo = exp(-r2 * 1.6) * 0.16;
  float psf = core + halo;

  gl_FragColor = vec4(vColour * vIntensity * psf, 1.0);
}`,Bn=`varying vec3 vEquatorial;

void main() {
  
  vEquatorial = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,Vn=`precision highp float;

#ifndef ENDLESS_FISHING_CONSTANTS\r
#define ENDLESS_FISHING_CONSTANTS

const float PI = 3.14159265358979323846;\r
const float TWO_PI = 6.28318530717958647692;\r
const float HALF_PI = 1.57079632679489661923;\r
const float INV_PI = 0.31830988618379067154;\r
const float INV_FOUR_PI = 0.07957747154594766788;\r
const float DEG_TO_RAD = 0.01745329251994329577;\r
const float RAD_TO_DEG = 57.2957795130823208768;

const float EPS = 1e-6;

#ifndef saturate\r
float saturate(float x) { return clamp(x, 0.0, 1.0); }\r
vec2 saturate(vec2 x) { return clamp(x, 0.0, 1.0); }\r
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }\r
#endif

float ef_luminance(vec3 colour) {\r
  return dot(colour, vec3(0.2126, 0.7152, 0.0722));\r
}

float remap(float x, float lowIn, float highIn, float lowOut, float highOut) {\r
  float span = highIn - lowIn;\r
  float t = span == 0.0 ? step(lowIn, x) : (x - lowIn) / span;\r
  return lowOut + saturate(t) * (highOut - lowOut);\r
}

vec3 hdrClamp(vec3 colour) {\r
  vec3 safe;\r
  safe.x = colour.x == colour.x ? colour.x : 0.0;\r
  safe.y = colour.y == colour.y ? colour.y : 0.0;\r
  safe.z = colour.z == colour.z ? colour.z : 0.0;\r
  
  
  return clamp(safe, vec3(0.0), vec3(60000.0));\r
}

float hdrClampAlpha(float alpha) {\r
  return clamp(alpha == alpha ? alpha : 0.0, 0.0, 1.0);\r
}

#endif

varying vec3 vEquatorial;

uniform float uNightFactor;
uniform float uIntensity;

uniform vec3 uZenithEquatorial;

const float MILKY_WAY_PEAK_RADIANCE = 2.6e-4;

const float NGP_RA = 3.36603292;      
const float NGP_DEC = 0.473478800;    
const float GALACTIC_NODE = 2.14556804; 

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float sum = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    sum += amplitude * valueNoise(p);
    p *= 2.03;  
    amplitude *= 0.5;
  }
  return sum;
}

void main() {
  vec3 dir = normalize(vEquatorial);

  
  float dec = asin(clamp(dir.z, -1.0, 1.0));
  float ra = atan(dir.y, dir.x);

  float sinDec = sin(dec);
  float cosDec = cos(dec);
  float deltaRa = ra - NGP_RA;

  float sinB = sinDec * sin(NGP_DEC) + cosDec * cos(NGP_DEC) * cos(deltaRa);
  float b = asin(clamp(sinB, -1.0, 1.0));
  float y = cosDec * sin(deltaRa);
  float x = sinDec * cos(NGP_DEC) - cosDec * sin(NGP_DEC) * cos(deltaRa);
  float l = GALACTIC_NODE - atan(y, x);

  
  float bDeg = b * RAD_TO_DEG;
  float disc = exp(-(bDeg * bDeg) / (2.0 * 7.0 * 7.0));

  
  float towardsCentre = cos(l);
  float bulge = exp(-(bDeg * bDeg) / (2.0 * 13.0 * 13.0)) * smoothstep(-0.2, 1.0, towardsCentre);
  float longitudeFalloff = 0.42 + 0.58 * smoothstep(-1.0, 1.0, towardsCentre);

  float band = disc * longitudeFalloff + bulge * 0.55;

  
  vec2 galactic = vec2(l * 2.6, b * 7.0);
  float clumps = 0.55 + 0.9 * fbm(galactic * 2.2);

  
  
  float rift = fbm(vec2(l * 3.4, b * 16.0) + 41.7);
  float dust = smoothstep(0.38, 0.72, rift) * disc * (0.35 + 0.5 * smoothstep(-0.3, 1.0, towardsCentre));

  float brightness = max(0.0, band * clumps - dust * 0.85);

  
  float altitude = dot(dir, uZenithEquatorial);
  float airMass = 1.0 / max(0.05, altitude + 0.025 / (max(altitude, -0.03) + 0.04));
  float extinction = pow(10.0, -0.4 * 0.21 * airMass) * smoothstep(-0.02, 0.08, altitude);

  
  vec3 tint = mix(vec3(0.78, 0.82, 1.0), vec3(1.0, 0.86, 0.68), dust * 0.7);

  
  
  
  float profile = brightness * extinction * uNightFactor * uIntensity;
  if (profile <= 0.002) discard;
  gl_FragColor = vec4(tint * profile * MILKY_WAY_PEAK_RADIANCE, 1.0);
}`,Hn=9e3,Un=class n{points;milkyWay;starMaterial;milkyWayMaterial;geometry;milkyWayGeometry;rotation=new b;zenithEquatorial=new t;catalog;constructor(n){this.catalog=n,this.geometry=new L;let r=new Float32Array(n.positions.length);for(let e=0;e<n.positions.length;e+=1)r[e]=(n.positions[e]??0)*Hn;this.geometry.setAttribute(`position`,new j(r,3)),this.geometry.setAttribute(`aMagnitude`,new j(n.magnitudes,1)),this.geometry.setAttribute(`aColour`,new j(n.colours,3)),this.geometry.boundingSphere=null,this.starMaterial=new i({vertexShader:Rn,fragmentShader:zn,uniforms:{uPixelScale:{value:2.2},uNightFactor:{value:0},uTime:{value:0},uIntensity:{value:1},uMagnitudeLimit:{value:6.5}},transparent:!0,blending:2,depthTest:!1,depthWrite:!1}),this.points=new fe(this.geometry,this.starMaterial),this.points.frustumCulled=!1,this.points.matrixAutoUpdate=!1,this.points.renderOrder=-900,this.milkyWayGeometry=new u(Hn*.99,48,32),this.milkyWayMaterial=new i({vertexShader:Bn,fragmentShader:Vn,uniforms:{uNightFactor:{value:0},uIntensity:{value:1},uZenithEquatorial:{value:new t(0,0,1)}},side:1,transparent:!0,blending:2,depthTest:!1,depthWrite:!1}),this.milkyWay=new e(this.milkyWayGeometry,this.milkyWayMaterial),this.milkyWay.frustumCulled=!1,this.milkyWay.matrixAutoUpdate=!1,this.milkyWay.renderOrder=-901}static async load(e){let t=await e.loadBinary(`processed/stars/bsc5.bin`);return new n(Fn(t))}update(e,t,n,r){let i=e.siderealTime,a=e.location.latitudeDeg*Math.PI/180,o=Math.cos(i),s=Math.sin(i),c=Math.cos(a),l=Math.sin(a);this.rotation.set(-s,o,0,0,c*o,c*s,l,0,l*o,l*s,-c,0,0,0,0,1),this.rotation.setPosition(t),this.points.matrix.copy(this.rotation),this.points.matrixWorld.copy(this.rotation),this.milkyWay.matrix.copy(this.rotation),this.milkyWay.matrixWorld.copy(this.rotation),this.zenithEquatorial.set(c*o,c*s,l),Wn(this.starMaterial,`uNightFactor`,r),Wn(this.starMaterial,`uTime`,n),Wn(this.milkyWayMaterial,`uNightFactor`,r);let u=this.milkyWayMaterial.uniforms.uZenithEquatorial;u!==void 0&&u.value.copy(this.zenithEquatorial)}configure(e,t,n){Wn(this.starMaterial,`uPixelScale`,e),Wn(this.starMaterial,`uMagnitudeLimit`,t),Wn(this.starMaterial,`uIntensity`,n),Wn(this.milkyWayMaterial,`uIntensity`,n)}dispose(){this.geometry.dispose(),this.milkyWayGeometry.dispose(),this.starMaterial.dispose(),this.milkyWayMaterial.dispose()}};function Wn(e,t,n){let r=e.uniforms[t];r!==void 0&&(r.value=n)}var Gn=6378.14,Kn=.99664719,qn=149597870.7,Jn=[[0,0,1,0,6288774,-20905355],[2,0,-1,0,1274027,-3699111],[2,0,0,0,658314,-2955968],[0,0,2,0,213618,-569925],[0,1,0,0,-185116,48888],[0,0,0,2,-114332,-3149],[2,0,-2,0,58793,246158],[2,-1,-1,0,57066,-152138],[2,0,1,0,53322,-170733],[2,-1,0,0,45758,-204586],[0,1,-1,0,-40923,-129620],[1,0,0,0,-34720,108743],[0,1,1,0,-30383,104755],[2,0,0,-2,15327,10321],[0,0,1,2,-12528,0],[0,0,1,-2,10980,79661],[4,0,-1,0,10675,-34782],[0,0,3,0,10034,-23210],[4,0,-2,0,8548,-21636],[2,1,-1,0,-7888,24208],[2,1,0,0,-6766,30824],[1,0,-1,0,-5163,-8379],[1,1,0,0,4987,-16675],[2,-1,1,0,4036,-12831],[2,0,2,0,3994,-10445],[4,0,0,0,3861,-11650],[2,0,-3,0,3665,14403],[0,1,-2,0,-2689,-7003],[2,0,-1,2,-2602,0],[2,-1,-2,0,2390,10056],[1,0,1,0,-2348,6322],[2,-2,0,0,2236,-9884],[0,1,2,0,-2120,5751],[0,2,0,0,-2069,0],[2,-2,-1,0,2048,-4950],[2,0,1,-2,-1773,4130],[2,0,0,2,-1595,0],[4,-1,-1,0,1215,-3958],[0,0,2,2,-1110,0],[3,0,-1,0,-892,3258],[2,1,1,0,-810,2616],[4,-1,-2,0,759,-1897],[0,2,-1,0,-713,-2117],[2,2,-1,0,-700,2354],[2,1,-2,0,691,0],[2,-1,0,-2,596,0],[4,0,1,0,549,-1423],[0,0,4,0,537,-1117],[4,-1,0,0,520,-1571],[1,0,-2,0,-487,-1739],[2,1,0,-2,-399,0],[0,0,2,-2,-381,-4421],[1,1,1,0,351,0],[3,0,-2,0,-340,0],[4,0,-3,0,330,0],[2,-1,2,0,327,0],[0,2,1,0,-323,1165],[1,1,-1,0,299,0],[2,0,3,0,294,0],[2,0,-1,-2,0,8752]],Yn=[[0,0,0,1,5128122],[0,0,1,1,280602],[0,0,1,-1,277693],[2,0,0,-1,173237],[2,0,-1,1,55413],[2,0,-1,-1,46271],[2,0,0,1,32573],[0,0,2,1,17198],[2,0,1,-1,9266],[0,0,2,-1,8822],[2,-1,0,-1,8216],[2,0,-2,-1,4324],[2,0,1,1,4200],[2,1,0,-1,-3359],[2,-1,-1,1,2463],[2,-1,0,1,2211],[2,-1,-1,-1,2065],[0,1,-1,-1,-1870],[4,0,-1,-1,1828],[0,1,0,1,-1794],[0,0,0,3,-1749],[0,1,-1,1,-1565],[1,0,0,1,-1491],[0,1,1,1,-1475],[0,1,1,-1,-1410],[0,1,0,-1,-1344],[1,0,0,-1,-1335],[0,0,3,1,1107],[4,0,0,-1,1021],[4,0,-1,1,833],[0,0,1,-3,777],[4,0,-2,1,671],[2,0,0,-3,607],[2,0,2,-1,596],[2,-1,1,-1,491],[2,0,-2,1,-451],[0,0,3,-1,439],[2,0,2,1,422],[2,0,-3,-1,421],[2,1,-1,1,-366],[2,1,0,1,-351],[4,0,0,1,331],[2,-1,1,1,315],[2,-2,0,-1,302],[0,0,1,3,-283],[2,1,1,-1,-229],[1,1,0,-1,223],[1,1,0,1,223],[0,1,-2,-1,-220],[2,1,-1,-1,-220],[1,0,1,1,-185],[2,-1,-2,-1,181],[0,1,2,1,-177],[4,0,-2,-1,176],[4,-1,-1,-1,166],[1,0,1,-1,-164],[4,0,1,-1,132],[1,0,-1,-1,-119],[4,-1,0,-1,115],[2,-2,0,1,107]],Xn=29.530588853;function Zn(e,t,n){let{T:r}=e,i=r*r,a=i*r,o=a*r,s=B(218.3164477+481267.88123421*r-.0015786*i+a/538841-o/65194e3),c=B(297.8501921+445267.1114034*r-.0018819*i+a/545868-o/113065e3),l=B(357.5291092+35999.0502909*r-1536e-7*i+a/2449e4),u=B(134.9633964+477198.8675055*r+.0087414*i+a/69699-o/14712e3),d=B(93.272095+483202.0175233*r-.0036539*i-a/3526e3+o/86331e4),f=B(119.75+131.849*r),p=B(53.09+479264.29*r),m=B(313.45+481266.484*r),h=1-.002516*r-74e-7*i,g=h*h,_=0,v=0;for(let[e,t,n,r,i,a]of Jn){let o=e*c+t*l+n*u+r*d,s=t===0?1:Math.abs(t)===1?h:g;_+=i*s*V(o),v+=a*s*rn(o)}let y=0;for(let[e,t,n,r,i]of Yn){let a=e*c+t*l+n*u+r*d;y+=i*(t===0?1:Math.abs(t)===1?h:g)*V(a)}_+=3958*V(f)+1962*V(s-d)+318*V(p),y+=-2235*V(s)+382*V(m)+175*V(f-d)+175*V(f+d)+127*V(s-u)-115*V(s+u);let{deltaPsi:b,trueObliquity:x}=an(r),S=nn((s+_/1e6)*z+b),C=y/1e6*z,w=385000.56+v/1e3,T=sn({longitude:S,latitude:C,distance:w},x),E=Math.asin(Gn/w),D=fn(e.jd,r,t.longitudeDeg),O=$n(T,pn(D,T.rightAscension),E,t),ee=pn(D,O.rightAscension),k=cn(O.declination,ee,t.latitudeDeg),te=358473400/w*Xt*(1+Math.sin(k.altitude)*Math.sin(E)),A=Sn(e,t,n),j=A.distanceAu*qn,M=ln(A.equatorial.rightAscension,A.equatorial.declination,T.rightAscension,T.declination),N=Math.atan2(j*Math.sin(M),w-j*Math.cos(M)),ne=(1+Math.cos(N))/2,P=A.equatorial.rightAscension-T.rightAscension,re=nn(Math.atan2(Math.cos(A.equatorial.declination)*Math.sin(P),Math.sin(A.equatorial.declination)*Math.cos(T.declination)-Math.cos(A.equatorial.declination)*Math.sin(T.declination)*Math.cos(P))),ie=t.latitudeDeg*z,ae=Math.atan2(Math.sin(ee),Math.tan(ie)*Math.cos(O.declination)-Math.sin(O.declination)*Math.cos(ee)),oe=B(c)/360*Xn,se=B(c)<180,ce=Qn(r,S,C,b,x,d,T.rightAscension);return{equatorial:T,topocentric:O,horizontal:k,apparentAltitude:vn(k.altitude,n),angularRadius:te,distanceKm:w,parallax:E,phaseAngle:N,illuminatedFraction:ne,brightLimbAngle:re,brightLimbScreenAngle:nn(re-ae),parallacticAngle:ae,ageDays:oe,phaseName:er(ne,se),waxing:se,sunDirection:tr(N,re,ae),librationLongitude:ce.longitude,librationLatitude:ce.latitude,axisPositionAngle:ce.axisPositionAngle,northScreenAngle:nn(ce.axisPositionAngle-ae)}}function Qn(e,t,n,r,i,a,o){let s=1.54242*z,c=B(125.0445479-1934.1362891*e+.0020754*e*e+e*e*e/467441-e*e*e*e/60616e3)*z,l=a*z,u=t-r-c,d=Math.cos(n),f=Math.sin(n),p=nn(Math.atan2(Math.sin(u)*d*Math.cos(s)-f*Math.sin(s),Math.cos(u)*d)-l+Math.PI)-Math.PI,m=Math.asin(Math.min(1,Math.max(-1,-Math.sin(u)*d*Math.sin(s)-f*Math.cos(s)))),h=c+r,g=Math.sin(s)*Math.sin(h),_=Math.sin(s)*Math.cos(h)*Math.cos(i)-Math.cos(s)*Math.sin(i);return{longitude:p,latitude:m,axisPositionAngle:Math.asin(Math.min(1,Math.max(-1,Math.hypot(g,_)*Math.cos(o-Math.atan2(g,_))/Math.cos(m))))}}function $n(e,t,n,r){let i=r.latitudeDeg*z,a=Math.atan(Kn*Math.tan(i)),o=r.elevationM/(Gn*1e3),s=Kn*Math.sin(a)+o*Math.sin(i),c=Math.cos(a)+o*Math.cos(i),l=Math.sin(n),u=Math.cos(e.declination),d=Math.sin(e.declination),f=u-c*l*Math.cos(t),p=Math.atan2(-c*l*Math.sin(t),f),m=Math.atan2((d-s*l)*Math.cos(p),f);return{rightAscension:nn(e.rightAscension+p),declination:m,distance:e.distance}}function er(e,t){return e<.02?`new`:e>.98?`full`:Math.abs(e-.5)<.04?t?`first-quarter`:`last-quarter`:e<.5?t?`waxing-crescent`:`waning-crescent`:t?`waxing-gibbous`:`waning-gibbous`}function tr(e,t,n){let r=t-n,i=Math.sin(e);return{x:i*Math.sin(r),y:i*Math.cos(r),z:Math.cos(e)}}function nr(e,t,n){let r=e*Yt;if(r<-.9)return 0;let i=Math.min(180,Math.abs(n*Yt)),a=10**(-.4*(.026*i+4e-9*i**4)),o=(384400/t)**2,s=.7**(1/(Math.sin(e)+.50572*(r+6.07995)**-1.6364))**.678;return .267*a*o*s*Math.max(0,Math.sin(e))}var rr=-18;function ir(e,t){let n=Math.cos(e);return{x:n*Math.sin(t),y:Math.sin(e),z:-n*Math.cos(t)}}function ar(e,t,n){let r=tn(e),i=Sn(r,t,n),a=Zn(r,t,n),o=i.horizontal.altitude*Yt,s=a.horizontal.altitude*Yt,c=(o-rr)/24,l=Math.min(1,Math.max(0,c)),u=l*l*l*(l*(l*6-15)+10);return{time:r,location:t,sun:i,moon:a,sunDirection:ir(i.horizontal.altitude,i.horizontal.azimuth),sunDirectionRefracted:ir(i.apparentAltitude,i.horizontal.azimuth),moonDirection:ir(a.apparentAltitude,a.horizontal.azimuth),sunAltitudeDeg:o,sunAzimuthDeg:i.horizontal.azimuth*Yt,moonAltitudeDeg:s,moonAzimuthDeg:a.horizontal.azimuth*Yt,sunIlluminanceLux:Tn(i.apparentAltitude,i.distanceAu),moonIlluminanceLux:nr(a.apparentAltitude,a.distanceKm,a.phaseAngle),twilight:wn(o),dayFactor:u,siderealTime:fn(r.jd,r.T,t.longitudeDeg)}}function or(e){let t=e.sunIlluminanceLux,n=e.moonIlluminanceLux,r=t+Math.max(0,40*Math.exp(e.sunAltitudeDeg/3.2))+n;return r<=0?0:n/r}var sr=4294967296;function cr(e){let t=e>>>0;return()=>{t=t+2654435769>>>0;let e=t;return e=Math.imul(e^e>>>16,569420461)>>>0,e=Math.imul(e^e>>>15,1935289751)>>>0,(e^e>>>15)>>>0}}function lr(e,t,n){let r=2654435769^e>>>0;return r=Math.imul(r^t>>>0,2246822507)>>>0,r=Math.imul(r^r>>>13,3266489909)>>>0,r=Math.imul(r^n>>>0,668265263)>>>0,r=Math.imul(r^r>>>16,374761393)>>>0,(r^r>>>15)>>>0}var H=class e{a;b;c;d;constructor(e){let t=cr(e);this.a=t(),this.b=t(),this.c=t(),this.d=t();for(let e=0;e<12;e+=1)this.next()}next(){let e=this.a+this.b>>>0;this.a=this.b^this.b>>>9,this.b=this.c+(this.c<<3)>>>0,this.c=(this.c<<21|this.c>>>11)>>>0,this.d=this.d+1>>>0;let t=e+this.d>>>0;return this.c=this.c+t>>>0,t/sr}range(e,t){return e+this.next()*(t-e)}int(e,t){return e+Math.floor(this.next()*(t-e+1))}bool(e=.5){return this.next()<e}gaussian(e=0,t=1){let n=Math.max(this.next(),2**-52),r=this.next();return e+t*Math.sqrt(-2*Math.log(n))*Math.cos(2*Math.PI*r)}pick(e){if(e.length!==0)return e[Math.floor(this.next()*e.length)]}shuffle(e){for(let t=e.length-1;t>0;--t){let n=Math.floor(this.next()*(t+1)),r=e[t],i=e[n];r!==void 0&&i!==void 0&&(e[t]=i,e[n]=r)}return e}weightedIndex(e){let t=0;for(let n of e)t+=Math.max(0,n);if(t<=0)return-1;let n=this.next()*t;for(let t=0;t<e.length;t+=1)if(n-=Math.max(0,e[t]??0),n<=0)return t;return e.length-1}static deriveStream(t,n,r){return new e(lr(t,n|0,r|0))}},ur=.5*(Math.sqrt(3)-1),dr=(3-Math.sqrt(3))/6,fr=1/3,pr=1/6,U=new Float32Array([1,1,0,-1,1,0,1,-1,0,-1,-1,0,1,0,1,-1,0,1,1,0,-1,-1,0,-1,0,1,1,0,-1,1,0,1,-1,0,-1,-1]),mr=class{perm=new Uint8Array(512);permMod12=new Uint8Array(512);constructor(e){let t=new Uint8Array(256);for(let e=0;e<256;e+=1)t[e]=e;let n=cr(e);for(let e=255;e>0;--e){let r=n()%(e+1),i=t[e]??0;t[e]=t[r]??0,t[r]=i}for(let e=0;e<512;e+=1){let n=t[e&255]??0;this.perm[e]=n,this.permMod12[e]=n%12}}noise2(e,t){let n=(e+t)*ur,r=Math.floor(e+n),i=Math.floor(t+n),a=(r+i)*dr,o=e-(r-a),s=t-(i-a),c=+(o>s),l=o>s?0:1,u=o-c+dr,d=s-l+dr,f=o-1+2*dr,p=s-1+2*dr,m=r&255,h=i&255,g=(this.permMod12[m+(this.perm[h]??0)]??0)*3,_=(this.permMod12[m+c+(this.perm[h+l]??0)]??0)*3,v=(this.permMod12[m+1+(this.perm[h+1]??0)]??0)*3,y=0,b=.5-o*o-s*s;b>0&&(b*=b,y+=b*b*((U[g]??0)*o+(U[g+1]??0)*s));let x=.5-u*u-d*d;x>0&&(x*=x,y+=x*x*((U[_]??0)*u+(U[_+1]??0)*d));let S=.5-f*f-p*p;return S>0&&(S*=S,y+=S*S*((U[v]??0)*f+(U[v+1]??0)*p)),70*y}noise3(e,t,n){let r=(e+t+n)*fr,i=Math.floor(e+r),a=Math.floor(t+r),o=Math.floor(n+r),s=(i+a+o)*pr,c=e-(i-s),l=t-(a-s),u=n-(o-s),d,f,p,m,h,g;c>=l?l>=u?(d=1,f=0,p=0,m=1,h=1,g=0):c>=u?(d=1,f=0,p=0,m=1,h=0,g=1):(d=0,f=0,p=1,m=1,h=0,g=1):l<u?(d=0,f=0,p=1,m=0,h=1,g=1):c<u?(d=0,f=1,p=0,m=0,h=1,g=1):(d=0,f=1,p=0,m=1,h=1,g=0);let _=c-d+pr,v=l-f+pr,y=u-p+pr,b=c-m+2*pr,x=l-h+2*pr,S=u-g+2*pr,C=c-1+3*pr,w=l-1+3*pr,T=u-1+3*pr,E=i&255,D=a&255,O=o&255,ee=(this.permMod12[E+(this.perm[D+(this.perm[O]??0)]??0)]??0)*3,k=(this.permMod12[E+d+(this.perm[D+f+(this.perm[O+p]??0)]??0)]??0)*3,te=(this.permMod12[E+m+(this.perm[D+h+(this.perm[O+g]??0)]??0)]??0)*3,A=(this.permMod12[E+1+(this.perm[D+1+(this.perm[O+1]??0)]??0)]??0)*3,j=0,M=.6-c*c-l*l-u*u;M>0&&(M*=M,j+=M*M*((U[ee]??0)*c+(U[ee+1]??0)*l+(U[ee+2]??0)*u));let N=.6-_*_-v*v-y*y;N>0&&(N*=N,j+=N*N*((U[k]??0)*_+(U[k+1]??0)*v+(U[k+2]??0)*y));let ne=.6-b*b-x*x-S*S;ne>0&&(ne*=ne,j+=ne*ne*((U[te]??0)*b+(U[te+1]??0)*x+(U[te+2]??0)*S));let P=.6-C*C-w*w-T*T;return P>0&&(P*=P,j+=P*P*((U[A]??0)*C+(U[A+1]??0)*w+(U[A+2]??0)*T)),32*j}fbm2(e,t,n=4,r=2,i=.5){let a=1,o=1,s=0,c=0;for(let l=0;l<n;l+=1)s+=a*this.noise2(e*o,t*o),c+=a,a*=i,o*=r;return c===0?0:s/c}fbm3(e,t,n,r=4,i=2,a=.5){let o=1,s=1,c=0,l=0;for(let u=0;u<r;u+=1)c+=o*this.noise3(e*s,t*s,n*s),l+=o,o*=a,s*=i;return l===0?0:c/l}ridged2(e,t,n=5,r=2,i=.5){let a=1,o=1,s=0,c=0;for(let l=0;l<n;l+=1){let n=1-Math.abs(this.noise2(e*o,t*o));s+=a*n*n,c+=a,a*=i,o*=r}return c===0?0:s/c}};function W(e,t,n){if(e===t)return n<e?0:1;let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)}function G(e,t,n){return e<t?t:e>n?n:e}function hr(e,t,n){return e+(t-e)*n}function K(e,t,n,r){return t+(e-t)*Math.exp(-n*r)}var gr=`varying vec3 vViewRay;

uniform mat4 uInverseProjection;
uniform mat4 uCameraWorld;

void main() {
  vec4 clip = vec4(position.xy, 1.0, 1.0);
  vec4 viewSpace = uInverseProjection * clip;
  viewSpace /= viewSpace.w;
  
  vViewRay = mat3(uCameraWorld) * viewSpace.xyz;
  gl_Position = clip;
}`,_r=`precision highp float;

#ifndef ENDLESS_FISHING_CONSTANTS\r
#define ENDLESS_FISHING_CONSTANTS

const float PI = 3.14159265358979323846;\r
const float TWO_PI = 6.28318530717958647692;\r
const float HALF_PI = 1.57079632679489661923;\r
const float INV_PI = 0.31830988618379067154;\r
const float INV_FOUR_PI = 0.07957747154594766788;\r
const float DEG_TO_RAD = 0.01745329251994329577;\r
const float RAD_TO_DEG = 57.2957795130823208768;

const float EPS = 1e-6;

#ifndef saturate\r
float saturate(float x) { return clamp(x, 0.0, 1.0); }\r
vec2 saturate(vec2 x) { return clamp(x, 0.0, 1.0); }\r
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }\r
#endif

float ef_luminance(vec3 colour) {\r
  return dot(colour, vec3(0.2126, 0.7152, 0.0722));\r
}

float remap(float x, float lowIn, float highIn, float lowOut, float highOut) {\r
  float span = highIn - lowIn;\r
  float t = span == 0.0 ? step(lowIn, x) : (x - lowIn) / span;\r
  return lowOut + saturate(t) * (highOut - lowOut);\r
}

vec3 hdrClamp(vec3 colour) {\r
  vec3 safe;\r
  safe.x = colour.x == colour.x ? colour.x : 0.0;\r
  safe.y = colour.y == colour.y ? colour.y : 0.0;\r
  safe.z = colour.z == colour.z ? colour.z : 0.0;\r
  
  
  return clamp(safe, vec3(0.0), vec3(60000.0));\r
}

float hdrClampAlpha(float alpha) {\r
  return clamp(alpha == alpha ? alpha : 0.0, 0.0, 1.0);\r
}

#endif
#ifndef ENDLESS_FISHING_ATMOSPHERE
#define ENDLESS_FISHING_ATMOSPHERE

const float GROUND_RADIUS = 6360.0;
const float ATMOSPHERE_RADIUS = 6460.0;

const vec3 RAYLEIGH_SCATTERING = vec3(5.802, 13.558, 33.100) * 1e-3;
const float RAYLEIGH_SCALE_HEIGHT = 8.0;

const float MIE_SCATTERING = 3.996e-3;
const float MIE_EXTINCTION = 4.400e-3;
const float MIE_SCALE_HEIGHT = 1.2;

const float MIE_ASYMMETRY = 0.8;

const vec3 OZONE_ABSORPTION = vec3(0.650, 1.881, 0.085) * 1e-3;
const float OZONE_CENTRE = 25.0;
const float OZONE_HALF_WIDTH = 15.0;

const vec3 GROUND_ALBEDO = vec3(0.06, 0.07, 0.08);

struct MediumSample {
  vec3 scattering;   
  vec3 extinction;   
  vec3 rayleigh;     
  float mie;         
};

MediumSample sampleMedium(float radius) {
  float altitude = max(0.0, radius - GROUND_RADIUS);

  float rayleighDensity = exp(-altitude / RAYLEIGH_SCALE_HEIGHT);
  float mieDensity = exp(-altitude / MIE_SCALE_HEIGHT);
  float ozoneDensity = max(0.0, 1.0 - abs(altitude - OZONE_CENTRE) / OZONE_HALF_WIDTH);

  MediumSample medium;
  medium.rayleigh = RAYLEIGH_SCATTERING * rayleighDensity;
  medium.mie = MIE_SCATTERING * mieDensity;
  medium.scattering = medium.rayleigh + vec3(medium.mie);
  medium.extinction =
      medium.rayleigh + vec3(MIE_EXTINCTION * mieDensity) + OZONE_ABSORPTION * ozoneDensity;
  return medium;
}

float rayleighPhase(float cosTheta) {
  return 3.0 / (16.0 * PI) * (1.0 + cosTheta * cosTheta);
}

float miePhase(float cosTheta, float g) {
  float g2 = g * g;
  float numerator = 3.0 * (1.0 - g2) * (1.0 + cosTheta * cosTheta);
  float denominator = 8.0 * PI * (2.0 + g2) * pow(max(0.0, 1.0 + g2 - 2.0 * g * cosTheta), 1.5);
  return numerator / denominator;
}

float raySphereIntersect(vec3 origin, vec3 direction, float radius) {
  float b = dot(origin, direction);
  float c = dot(origin, origin) - radius * radius;
  if (c > 0.0 && b > 0.0) return -1.0;
  float discriminant = b * b - c;
  if (discriminant < 0.0) return -1.0;
  float sqrtDiscriminant = sqrt(discriminant);
  float near = -b - sqrtDiscriminant;
  float far = -b + sqrtDiscriminant;
  return near < 0.0 ? far : near;
}

bool intersectsGround(vec3 origin, vec3 direction) {
  return raySphereIntersect(origin, direction, GROUND_RADIUS) > 0.0;
}

vec2 transmittanceUv(float radius, float cosSunZenith) {
  float h = sqrt(max(0.0, ATMOSPHERE_RADIUS * ATMOSPHERE_RADIUS - GROUND_RADIUS * GROUND_RADIUS));
  float rho = sqrt(max(0.0, radius * radius - GROUND_RADIUS * GROUND_RADIUS));

  float discriminant =
      radius * radius * (cosSunZenith * cosSunZenith - 1.0) +
      ATMOSPHERE_RADIUS * ATMOSPHERE_RADIUS;
  float d = max(0.0, -radius * cosSunZenith + sqrt(max(0.0, discriminant)));

  float dMin = ATMOSPHERE_RADIUS - radius;
  float dMax = rho + h;
  return vec2((d - dMin) / max(EPS, dMax - dMin), rho / max(EPS, h));
}

void transmittanceParams(vec2 uv, out float radius, out float cosSunZenith) {
  float h = sqrt(max(0.0, ATMOSPHERE_RADIUS * ATMOSPHERE_RADIUS - GROUND_RADIUS * GROUND_RADIUS));
  float rho = h * uv.y;
  radius = sqrt(rho * rho + GROUND_RADIUS * GROUND_RADIUS);

  float dMin = ATMOSPHERE_RADIUS - radius;
  float dMax = rho + h;
  float d = dMin + uv.x * (dMax - dMin);
  cosSunZenith = d == 0.0
      ? 1.0
      : (h * h - rho * rho - d * d) / (2.0 * radius * d);
  cosSunZenith = clamp(cosSunZenith, -1.0, 1.0);
}

vec3 sampleTransmittance(sampler2D lut, float radius, float cosSunZenith) {
  return texture2DLodEXT(lut, transmittanceUv(radius, cosSunZenith), 0.0).rgb;
}

vec3 computeTransmittance(float radius, float cosSunZenith, int steps) {
  vec3 origin = vec3(0.0, radius, 0.0);
  vec3 direction = vec3(sqrt(max(0.0, 1.0 - cosSunZenith * cosSunZenith)), cosSunZenith, 0.0);

  float distanceToTop = raySphereIntersect(origin, direction, ATMOSPHERE_RADIUS);
  if (distanceToTop < 0.0) return vec3(1.0);

  float stepSize = distanceToTop / float(steps);
  vec3 opticalDepth = vec3(0.0);
  for (int i = 0; i < steps; i++) {
    
    float t = (float(i) + 0.5) * stepSize;
    MediumSample medium = sampleMedium(length(origin + direction * t));
    opticalDepth += medium.extinction * stepSize;
  }
  return exp(-opticalDepth);
}

vec2 skyViewUv(float radius, float cosViewZenith, float azimuth, bool hitsGround) {
  float horizonCos = sqrt(max(0.0, radius * radius - GROUND_RADIUS * GROUND_RADIUS)) / radius;
  float horizonAngle = acos(clamp(horizonCos, -1.0, 1.0));
  float viewZenithAngle = acos(clamp(cosViewZenith, -1.0, 1.0));
  
  float angleFromHorizon = horizonAngle - viewZenithAngle;

  float v;
  if (!hitsGround) {
    float t = sqrt(max(0.0, angleFromHorizon / max(EPS, horizonAngle)));
    v = 0.5 + 0.5 * t;
  } else {
    float t = sqrt(max(0.0, -angleFromHorizon / max(EPS, PI - horizonAngle)));
    v = 0.5 - 0.5 * t;
  }
  return vec2(azimuth / TWO_PI, clamp(v, 0.0, 1.0));
}

void skyViewParams(
    vec2 uv, float radius, out float cosViewZenith, out float azimuth, out bool hitsGround) {
  float horizonCos = sqrt(max(0.0, radius * radius - GROUND_RADIUS * GROUND_RADIUS)) / radius;
  float horizonAngle = acos(clamp(horizonCos, -1.0, 1.0));

  float viewZenithAngle;
  if (uv.y > 0.5) {
    float t = (uv.y - 0.5) * 2.0;
    viewZenithAngle = horizonAngle - t * t * horizonAngle;
    hitsGround = false;
  } else {
    float t = (0.5 - uv.y) * 2.0;
    viewZenithAngle = horizonAngle + t * t * (PI - horizonAngle);
    hitsGround = true;
  }
  cosViewZenith = cos(viewZenithAngle);
  azimuth = uv.x * TWO_PI;
}

#endif

varying vec3 vViewRay;

uniform sampler2D uSkyViewLut;
uniform sampler2D uTransmittanceLut;

uniform sampler2D uHdriA;
uniform sampler2D uHdriB;

uniform float uHdriBlend;

uniform float uHdriRotationA;
uniform float uHdriRotationB;

uniform float uHdriInvMeanA;
uniform float uHdriInvMeanB;

uniform float uHdriWeight;

uniform float uCloudiness;

uniform vec3 uSunDirection;
uniform vec3 uMoonDirection;
uniform float uSunAngularRadius;
uniform float uMoonAngularRadius;

uniform float uSunFlattening;
uniform vec3 uSunRadiance;
uniform vec3 uMoonRadiance;

uniform sampler2D uMoonAlbedo;
uniform sampler2D uMoonNormal;

uniform vec3 uMoonSunDirection;

uniform float uMoonNorthAngle;

uniform vec2 uMoonLibration;

uniform float uEarthshine;

uniform float uAltitudeKm;

uniform float uSkyIntensity;

uniform vec3 uMoonSkyRadiance;
uniform vec3 uAirglowRadiance;

vec3 sampleSkyView(vec3 direction) {
  float radius = GROUND_RADIUS + max(0.0, uAltitudeKm);
  vec3 origin = vec3(0.0, radius, 0.0);

  float cosViewZenith = direction.y;
  
  vec2 viewFlat = normalize(vec2(direction.x, direction.z) + vec2(EPS));
  vec2 sunFlat = normalize(vec2(uSunDirection.x, uSunDirection.z) + vec2(EPS));
  float azimuth = atan(
      viewFlat.x * sunFlat.y - viewFlat.y * sunFlat.x,
      viewFlat.x * sunFlat.x + viewFlat.y * sunFlat.y);
  if (azimuth < 0.0) azimuth += TWO_PI;

  bool hitsGround = intersectsGround(origin, direction);
  vec2 uv = skyViewUv(radius, cosViewZenith, azimuth, hitsGround);
  return texture2D(uSkyViewLut, uv).rgb;
}

vec3 rotateY(vec3 v, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec3(c * v.x + s * v.z, v.y, c * v.z - s * v.x);
}

vec2 equirectUv(vec3 direction) {
  float u = atan(direction.z, direction.x) * (0.5 / PI) + 0.5;
  float v = acos(clamp(direction.y, -1.0, 1.0)) * INV_PI;
  return vec2(fract(u), clamp(v, 0.001, 0.999));
}

vec3 suppressBakedSun(vec3 colour) {
  const float KNEE = 6.0;
  const float CEILING = 14.0;
  float l = max(ef_luminance(colour), EPS);
  if (l <= KNEE) return colour;
  float compressed = KNEE + (CEILING - KNEE) * (1.0 - exp(-(l - KNEE) / (CEILING - KNEE)));
  return colour * (compressed / l);
}

vec3 sampleHdriDetail(vec3 direction) {
  vec3 a =
      suppressBakedSun(texture2D(uHdriA, equirectUv(rotateY(direction, uHdriRotationA))).rgb) *
      uHdriInvMeanA;
  vec3 b =
      suppressBakedSun(texture2D(uHdriB, equirectUv(rotateY(direction, uHdriRotationB))).rgb) *
      uHdriInvMeanB;
  
  
  return clamp(mix(a, b, uHdriBlend), vec3(0.05), vec3(3.0));
}

float solarLimbDarkening(float normalisedRadius) {
  float mu = sqrt(max(0.0, 1.0 - normalisedRadius * normalisedRadius));
  return 1.0 - 0.6 * (1.0 - mu);
}

vec2 discCoordinates(vec3 direction, vec3 centre, float angularRadius, float flattening) {
  
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), centre) + vec3(EPS, 0.0, 0.0));
  vec3 up = cross(centre, right);
  vec3 offset = direction - centre * dot(direction, centre);
  float x = dot(offset, right) / angularRadius;
  float y = dot(offset, up) / max(EPS, angularRadius * flattening);
  return vec2(x, y);
}

vec3 renderMoon(vec3 direction, out float coverage) {
  coverage = 0.0;
  float cosAngle = dot(direction, uMoonDirection);
  if (cosAngle < cos(uMoonAngularRadius * 2.0)) return vec3(0.0);

  vec2 disc = discCoordinates(direction, uMoonDirection, uMoonAngularRadius, 1.0);
  float r2 = dot(disc, disc);
  if (r2 > 1.0) return vec3(0.0);

  
  coverage = smoothstep(1.0, 1.0 - 0.02, r2);

  
  float c = cos(-uMoonNorthAngle);
  float s = sin(-uMoonNorthAngle);
  vec2 lunar = vec2(disc.x * c - disc.y * s, disc.x * s + disc.y * c);
  float z = sqrt(max(0.0, 1.0 - dot(lunar, lunar)));
  vec3 surface = vec3(lunar.x, lunar.y, z);

  
  
  float lonLib = uMoonLibration.x;
  float latLib = uMoonLibration.y;
  vec3 toEarth = vec3(cos(latLib) * sin(lonLib), sin(latLib), cos(latLib) * cos(lonLib));
  vec3 northPole = vec3(0.0, 1.0, 0.0);
  vec3 bodyRight = normalize(cross(northPole, toEarth));
  vec3 bodyUp = cross(toEarth, bodyRight);
  vec3 body = bodyRight * surface.x + bodyUp * surface.y + toEarth * surface.z;

  float longitude = atan(body.x, body.z);
  float latitude = asin(clamp(body.y, -1.0, 1.0));
  vec2 uv = vec2(0.5 + longitude * (0.5 / PI), 0.5 - latitude * INV_PI);

  vec3 albedo = texture2D(uMoonAlbedo, uv).rgb;
  vec3 detail = texture2D(uMoonNormal, uv).rgb * 2.0 - 1.0;
  
  vec3 normal = normalize(surface + vec3(detail.x, detail.y, 0.0) * 0.55);

  float nDotL = dot(normal, uMoonSunDirection);
  float nDotV = normal.z;

  
  
  
  float mu0 = max(0.0, nDotL);
  float mu = max(EPS, nDotV);
  float lit = mu0 / (mu0 + mu);

  
  lit *= smoothstep(-0.06, 0.06, nDotL);

  
  
  float dark = 1.0 - smoothstep(-0.06, 0.12, nDotL);
  vec3 earthshine = albedo * uEarthshine * dark * mu * vec3(0.72, 0.82, 1.0);

  return albedo * uMoonRadiance * lit + earthshine;
}

void main() {
  vec3 direction = normalize(vViewRay);

  
  
  
  
  
  
  
  
  
  
  
  
  vec3 skyDirection = normalize(vec3(direction.x, max(direction.y, 0.0), direction.z) + vec3(EPS, 0.0, 0.0));

  vec3 atmosphere = sampleSkyView(skyDirection);

  
  
  
  vec3 zenith = texture2D(uSkyViewLut, vec2(0.5, 1.0)).rgb;
  atmosphere = mix(atmosphere, zenith * 0.88, uCloudiness);

  
  
  float upness = smoothstep(-0.08, 0.35, direction.y);
  float moonPhaseTerm = 4.0 * PI * rayleighPhase(dot(direction, uMoonDirection));
  atmosphere +=
      (uMoonSkyRadiance * mix(0.45, 1.0, upness) * (0.55 + 0.45 * moonPhaseTerm) +
       uAirglowRadiance * mix(0.6, 1.0, upness)) /
      uSkyIntensity;

  
  
  float aboveHorizon = smoothstep(-0.02, 0.06, direction.y);
  vec3 detail = sampleHdriDetail(direction);
  vec3 sky = atmosphere * mix(vec3(1.0), detail, uHdriWeight * aboveHorizon);

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  float sunAbove = smoothstep(-uSunAngularRadius, uSunAngularRadius, uSunDirection.y);
  vec2 sunDisc = discCoordinates(direction, uSunDirection, uSunAngularRadius, uSunFlattening);
  float sunR2 = dot(sunDisc, sunDisc);
  if (sunR2 < 1.0 && sunAbove > 0.0 && dot(direction, uSunDirection) > 0.0) {
    
    
    
    float radius = GROUND_RADIUS + max(0.0, uAltitudeKm);
    vec3 extinction = sampleTransmittance(uTransmittanceLut, radius, max(0.0, uSunDirection.y));
    float edge = 1.0 - smoothstep(0.94, 1.0, sunR2);
    sky += uSunRadiance * extinction * solarLimbDarkening(sqrt(sunR2)) * edge * sunAbove;
  }

  
  float moonAbove = smoothstep(-uMoonAngularRadius, uMoonAngularRadius, uMoonDirection.y);
  float moonCoverage;
  vec3 moon = renderMoon(direction, moonCoverage) * moonAbove;
  if (moonCoverage * moonAbove > 0.0) {
    float radius = GROUND_RADIUS + max(0.0, uAltitudeKm);
    vec3 extinction = sampleTransmittance(uTransmittanceLut, radius, max(0.0, uMoonDirection.y));
    
    
    
    sky = mix(sky, moon * extinction, moonCoverage * moonAbove);
  }

  gl_FragColor = vec4(hdrClamp(sky * uSkyIntensity), 1.0);
}`,vr=new a(.72,.8,1),yr=new a(1,.62,.36),br=new a(1,.96,.92),xr=5.6,Sr=2.2,Cr=15,wr=.006,Tr=.18,Er=class n{name=`sky`;priority=0;atmosphere=new Gt;library;stars;probe;dome;material;csm;sunDirection=new t(0,1,0);moonDirection=new t(0,-1,0);lightDirection=new t(0,-1,0);lightColour=new a;moonSunDirection=new t(0,0,1);libration=new x;inverseProjection=new b;weather=`partly-cloudy`;adaptedIlluminance=1e4;measuredSkyIlluminance=1e4;nightFloorLuminance=0;exposureSampleCountdown=0;adaptationPrimed=!1;constructor(n,r,a){this.library=r,this.stars=a,this.material=new i({vertexShader:gr,fragmentShader:_r,uniforms:{uInverseProjection:{value:new b},uCameraWorld:{value:new b},uSkyViewLut:{value:this.atmosphere.skyViewLut},uTransmittanceLut:{value:this.atmosphere.transmittanceLut},uHdriA:{value:null},uHdriB:{value:null},uHdriBlend:{value:0},uHdriRotationA:{value:0},uHdriRotationB:{value:0},uHdriInvMeanA:{value:1},uHdriInvMeanB:{value:1},uHdriWeight:{value:0},uCloudiness:{value:.2},uSunDirection:{value:new t(0,1,0)},uMoonDirection:{value:new t(0,-1,0)},uSunAngularRadius:{value:.00465},uMoonAngularRadius:{value:.00452},uSunFlattening:{value:1},uSunRadiance:{value:new t},uMoonRadiance:{value:new t},uMoonAlbedo:{value:null},uMoonNormal:{value:null},uMoonSunDirection:{value:new t(0,0,1)},uMoonNorthAngle:{value:0},uMoonLibration:{value:new x},uEarthshine:{value:0},uAltitudeKm:{value:Sr/1e3},uSkyIntensity:{value:xn},uMoonSkyRadiance:{value:new t},uAirglowRadiance:{value:new t}},depthTest:!1,depthWrite:!1,side:2}),this.dome=new e(Or(),this.material),this.dome.frustumCulled=!1,this.dome.renderOrder=-1e3,this.dome.layers.enable(1),this.dome.onBeforeRender=(e,t,n)=>{let r=this.material.uniforms,i=r.uInverseProjection,a=r.uCameraWorld;i!==void 0&&i.value.copy(this.inverseProjection.copy(n.projectionMatrix).invert()),a!==void 0&&a.value.copy(n.matrixWorld)},this.stars.milkyWay.layers.enable(1);let o=n.settings.graphics;this.csm=new Ae({maxFar:1400,cascades:Math.max(1,o.shadowCascades),mode:`practical`,parent:n.scene,shadowMapSize:o.shadowMapSize,lightDirection:this.lightDirection.clone(),camera:n.camera,lightIntensity:1,shadowBias:-5e-4}),this.csm.fade=!0,this.probe=new jt(n.renderer,o.probeResolution)}static async create(e){let[t,r]=await Promise.all([An.load(e.resources),Un.load(e.resources)]),i=new n(e,t,r),a=ar(e.time.epochMs,i.location(e)),o=t.select(i.weather,a.sunAltitudeDeg);await Promise.all([t.ensureLoaded(o.a),t.ensureLoaded(o.b)]);let[s,c]=await Promise.all([e.resources.loadTexture(`processed/moon/albedo.webp`,{srgb:!0}),e.resources.loadTexture(`processed/moon/normal.webp`,{srgb:!1})]);return s.wrapT=C,c.wrapT=C,i.setUniform(`uMoonAlbedo`,s),i.setUniform(`uMoonNormal`,c),e.scene.add(i.dome,i.stars.milkyWay,i.stars.points),i}resetAdaptation(){this.exposureSampleCountdown=0,this.adaptationPrimed=!1}get nightFloor(){return this.nightFloorLuminance}get skyIntensity(){let e=this.material.uniforms.uSkyIntensity;return typeof e?.value==`number`?e.value:xn}registerShadowMaterial(e){this.csm.setupMaterial(e)}setWeather(e){this.weather=e}update(e,t){let n=t.world,r=this.location(t),i={pressureMbar:n.pressureHpa,temperatureC:n.temperatureC},a=ar(t.time.epochMs,r,i);n.ephemeris=a,this.sunDirection.set(a.sunDirectionRefracted.x,a.sunDirectionRefracted.y,a.sunDirectionRefracted.z),this.moonDirection.set(a.moonDirection.x,a.moonDirection.y,a.moonDirection.z),this.updateAtmosphere(t,a),this.updateHdri(a,n.cloudiness),this.updateCelestialUniforms(a,i),this.updateLights(a,n.cloudiness),this.updateExposure(e,t,a,n);let o=1-W(-14,-3,a.sunAltitudeDeg);if(this.stars.update(a,t.camera.position,t.loop.elapsed,o),this.library.tick(),this.csm.update(),this.probe.update(t.renderer,t.scene,t.settings.graphics.probeFacesPerFrame)){let e=this.probe.texture;e!==null&&(t.scene.environment=e)}}onSettingsChanged(e){let t=e.settings.graphics;this.probe.setResolution(e.renderer,t.probeResolution);let n=e.height*e.pixelRatio/480,r=t.preset===`low`?5.2:t.preset===`medium`?6:6.5;this.stars.configure(n,r,1)}resize(e,t){this.stars.configure(t/480,6.5,1),this.csm.updateFrustums()}dispose(){this.csm.dispose(),this.probe.dispose(),this.atmosphere.dispose(),this.stars.dispose(),this.library.dispose(),this.material.dispose(),this.dome.geometry.dispose()}location(e){return{latitudeDeg:e.settings.world.latitudeDeg,longitudeDeg:e.settings.world.longitudeDeg,elevationM:Sr}}updateAtmosphere(e,t){this.atmosphere.update(e.renderer,t.sunAltitudeDeg,Sr/1e3,Math.max(32,Math.round(e.settings.graphics.cloudSteps*.6)))&&this.probe.invalidate()}updateHdri(e,t){let n=this.library.select(this.weather,e.sunAltitudeDeg),r=this.library.texture(n.a),i=this.library.texture(n.b),a=r??i??null,o=i??r??null;this.setUniform(`uHdriA`,a),this.setUniform(`uHdriB`,o),this.setUniform(`uHdriBlend`,r===void 0?1:i===void 0?0:n.blend),this.setUniform(`uHdriRotationA`,this.library.rotationFor(n.a,e.sunAzimuthDeg)),this.setUniform(`uHdriRotationB`,this.library.rotationFor(n.b,e.sunAzimuthDeg)),this.setUniform(`uHdriInvMeanA`,this.library.inverseMeanLuminance(n.a)),this.setUniform(`uHdriInvMeanB`,this.library.inverseMeanLuminance(n.b));let s=a===null?0:1,c=W(-8,2,e.sunAltitudeDeg),l=G(.18+t*.72,0,.95)*hr(.06,1,c);this.setUniform(`uHdriWeight`,s*l),this.setUniform(`uCloudiness`,t)}updateCelestialUniforms(e,t){let n=this.material.uniforms.uSunDirection;n!==void 0&&n.value.copy(this.sunDirection);let r=this.material.uniforms.uMoonDirection;r!==void 0&&r.value.copy(this.moonDirection),this.setUniform(`uSunAngularRadius`,e.sun.angularRadius),this.setUniform(`uMoonAngularRadius`,e.moon.angularRadius),this.setUniform(`uSunFlattening`,yn(e.sun.horizontal.altitude,e.sun.angularRadius,t));let i=Math.PI*e.sun.angularRadius*e.sun.angularRadius,a=xn/(e.sun.distanceAu*e.sun.distanceAu)/i;this.setVectorUniform(`uSunRadiance`,a,a,a);let o=nr(Math.max(.01,e.moon.apparentAltitude),e.moon.distanceKm,0)/(Math.PI*e.moon.angularRadius*e.moon.angularRadius)*xr;this.setVectorUniform(`uMoonRadiance`,o,o,o),this.moonSunDirection.set(e.moon.sunDirection.x,e.moon.sunDirection.y,e.moon.sunDirection.z);let s=this.material.uniforms.uMoonSunDirection;s!==void 0&&s.value.copy(this.moonSunDirection),this.setUniform(`uMoonNorthAngle`,e.moon.northScreenAngle),this.libration.set(e.moon.librationLongitude,e.moon.librationLatitude);let c=this.material.uniforms.uMoonLibration;c!==void 0&&c.value.copy(this.libration);let l=1-e.moon.illuminatedFraction;this.setUniform(`uEarthshine`,o*.014*l*l);let u=e.moonIlluminanceLux*.004/Math.PI;this.setVectorUniform(`uMoonSkyRadiance`,u*.72,u*.84,u*1);let d=24e-5*(1-e.dayFactor);this.setVectorUniform(`uAirglowRadiance`,d*.62,d*.78,d*1),this.nightFloorLuminance=Dr(u*.72,u*.84,u)*.85+Dr(d*.62,d*.78,d)*.9}updateLights(e,t){let n=or(e);this.lightDirection.copy(this.sunDirection).multiplyScalar(1-n).addScaledVector(this.moonDirection,n),this.lightDirection.lengthSq()<1e-8&&this.lightDirection.set(0,1,0),this.lightDirection.normalize().negate();let r=1-W(0,18,e.sunAltitudeDeg),i=br.clone().lerp(yr,r*r);this.lightColour.copy(i).lerp(vr,n);let a=1-t*.92,o=(e.sunIlluminanceLux*(1-n)+e.moonIlluminanceLux*n)*a;this.csm.lightDirection.copy(this.lightDirection),this.csm.lightIntensity=o;for(let e of this.csm.lights)e.color.copy(this.lightColour),e.intensity=o,e.castShadow=o>40}updateExposure(e,t,n,r){if(--this.exposureSampleCountdown,this.exposureSampleCountdown<=0){this.exposureSampleCountdown=Cr;let e=this.skyIntensity,n=n=>this.atmosphere.meanSkyViewRowLuminance(t.renderer,n)*e,r=.28*n(1)+.32*n(.75)+.4*n(.53);this.measuredSkyIlluminance=(r+this.nightFloorLuminance)*Math.PI}let i=(n.sunIlluminanceLux*.02+n.moonIlluminanceLux)*1,a=r.cloudiness,o=1-a*.9,s=Tr*(1-r.precipitation*.7),c=n.sunIlluminanceLux+n.moonIlluminanceLux,l=Math.max(1e-9,c*o*.35+c*a*s+i*o+this.measuredSkyIlluminance*(1-a*.85));if(!this.adaptationPrimed)this.adaptedIlluminance=Math.max(wr,l),this.adaptationPrimed=!0;else{let t=l>this.adaptedIlluminance?.9:.35;this.adaptedIlluminance=Math.max(wr,K(this.adaptedIlluminance,l,t,Math.min(e,.1)))}let u=this.adaptedIlluminance*.16/Math.PI;r.exposure=1/(1.2*2**Math.log2(u*100/12.5)),r.sceneIlluminanceLux=this.adaptedIlluminance}setUniform(e,t){let n=this.material.uniforms[e];n!==void 0&&(n.value=t)}setVectorUniform(e,t,n,r){let i=this.material.uniforms[e];i!==void 0&&i.value.set(t,n,r)}};function Dr(e,t,n){return .2126*e+.7152*t+.0722*n}function Or(){let e=new L;return e.setAttribute(`position`,new j(new Float32Array([-1,-1,0,3,-1,0,-1,3,0]),3)),e.setAttribute(`uv`,new j(new Float32Array([0,0,2,0,0,2]),2)),e.boundingSphere=null,e}var kr=9.80665;function Ar(e,t,n,r=3.3){if(e<=0||t<=0)return 0;let i=kr*n/(t*t),a=.076*i**-.22,o=kr/t*22*i**-.33,s=e<=o?.07:.09,c=Math.exp(-((e-o)**2)/(2*s*s*o*o));return a*kr*kr/e**5*Math.exp(-1.25*(o/e)**4)*r**c}function jr(e,t){if(e<=0)return 1;let n=kr*t/(e*e);return kr/e*22*n**-.33}var Mr=class{components=[];significantWaveHeight;peakPeriod;maxAmplitude;constructor(e){let{windSpeed:t,windDirection:n,fetchKm:r,waveCount:i,seed:a,spreading:o,amplitudeScale:s}=e,c=Math.max(1e3,r*1e3),l=Math.max(.2,t),u=jr(l,c);this.peakPeriod=2*Math.PI/u;let d=new H(a),f=u*.62,p=u*3.2,m=Math.max(3,Math.floor(i)),h=0,g=0;for(let e=0;e<m;e+=1){let t=(e+.5)/m,r=1+(d.next()-.5)*.22,i=f*(p/f)**t*r,a=e/m,_=(e+1)/m,v=f*((p/f)**_-(p/f)**a),y=o*Math.min(1,(u/i)**2.5)+1.2,b=n+Nr(d.next(),y),x=Ar(i,l,c),S=Math.sqrt(Math.max(0,2*x*v))*s,C=i*i/kr,w=.42/C;S=Math.min(S,w),h+=S*S/2,g+=S,this.components.push({amplitude:S,wavenumber:C,frequency:i,directionX:Math.sin(b),directionZ:-Math.cos(b),phase:d.next()*Math.PI*2,steepness:0})}let _=0;for(let e of this.components)_+=e.wavenumber*e.amplitude;let v=_>0?Math.min(1,.85/_):0;for(let e of this.components)e.steepness=v;this.significantWaveHeight=4*Math.sqrt(h),this.maxAmplitude=g}evaluate(e,t,n,r){let i=0,a=0,o=0;for(let r=0;r<this.components.length;r+=1){let s=this.components[r];if(s===void 0)continue;let c=s.directionX*e+s.directionZ*t,l=s.wavenumber*c-s.frequency*n+s.phase,u=Math.cos(l),d=Math.sin(l),f=s.steepness*s.amplitude;i+=f*s.directionX*u,a+=s.amplitude*d,o+=f*s.directionZ*u}return r.x=i,r.y=a,r.z=o,r}heightAt(e,t,n,r){let i=r??{x:0,y:0,z:0},a=e,o=t;for(let r=0;r<4;r+=1){this.evaluate(a,o,n,i);let r=e-(a+i.x),s=t-(o+i.z);a+=r,o+=s}return this.evaluate(a,o,n,i),i.y}normalAt(e,t,n,r){let i=1,a=0,o=0,s=0,c=0,l=1;for(let r=0;r<this.components.length;r+=1){let u=this.components[r];if(u===void 0)continue;let d=u.directionX*e+u.directionZ*t,f=u.wavenumber*d-u.frequency*n+u.phase,p=Math.cos(f),m=Math.sin(f),h=u.steepness*u.amplitude*u.wavenumber,g=u.amplitude*u.wavenumber;i-=h*u.directionX*u.directionX*m,o-=h*u.directionX*u.directionZ*m,a+=g*u.directionX*p,s-=h*u.directionZ*u.directionX*m,l-=h*u.directionZ*u.directionZ*m,c+=g*u.directionZ*p}let u=c*o-l*a,d=l*i-s*o,f=s*a-c*i,p=Math.hypot(u,d,f)||1;return r.x=u/p,r.y=d/p,r.z=f/p,r}jacobianAt(e,t,n){let r=1,i=0,a=0,o=1;for(let s=0;s<this.components.length;s+=1){let c=this.components[s];if(c===void 0)continue;let l=c.directionX*e+c.directionZ*t,u=c.wavenumber*l-c.frequency*n+c.phase,d=Math.sin(u),f=c.steepness*c.amplitude*c.wavenumber*d;r-=f*c.directionX*c.directionX,i-=f*c.directionX*c.directionZ,a-=f*c.directionZ*c.directionX,o-=f*c.directionZ*c.directionZ}return r*o-i*a}toUniformArray(e){let t=Math.min(this.components.length,Math.floor(e.length/8));for(let n=0;n<t;n+=1){let r=this.components[n];if(r===void 0)continue;e[n*4]=r.directionX,e[n*4+1]=r.directionZ,e[n*4+2]=r.amplitude,e[n*4+3]=r.wavenumber;let i=t*4+n*4;e[i]=r.frequency,e[i+1]=r.phase,e[i+2]=r.steepness,e[i+3]=0}return t}};function Nr(e,t){let n=Math.PI/2,r=0,i=new Float64Array(64);for(let e=0;e<64;e+=1){let a=-n+(e+.5)/64*Math.PI,o=Math.cos(a/2)**(2*t);i[e]=o,r+=o}if(r<=0)return 0;let a=0,o=e*r;for(let e=0;e<64;e+=1)if(a+=i[e]??0,a>=o)return-n+(e+.5)/64*Math.PI;return 0}function Pr(e,t,n,r){let i=(e%n+n)%n,a=(t%n+n)%n,o=i*374761393+a*668265263+r*2147483647|0;return o=Math.imul(o^o>>>13,1274126177),((o^o>>>16)>>>0)/4294967296}function Fr(e){return e*e*e*(e*(e*6-15)+10)}function Ir(e,t,n,r){let i=Math.floor(e),a=Math.floor(t),o=Fr(e-i),s=Fr(t-a),c=Pr(i,a,n,r),l=Pr(i+1,a,n,r),u=Pr(i,a+1,n,r),d=Pr(i+1,a+1,n,r);return(c+(l-c)*o)*(1-s)+(u+(d-u)*o)*s}function Lr(e,t,n,r,i,a=.5){let o=0,s=0,c=1,l=1;for(let u=0;u<r;u+=1)o+=c*Ir(e*l,t*l,n*l,i+u*97),s+=c,c*=a,l*=2;return s===0?0:o/s}function Rr(e=512,t=1337){let n=new Uint8Array(e*e*4),r=2.2,i=1.4,a=new Float32Array(e*e),o=new Float32Array(e*e);for(let n=0;n<e;n+=1)for(let r=0;r<e;r+=1){let i=r/e*8,s=n/e*8,c=1-Math.abs(Lr(i,s,8,4,t)*2-1);a[n*e+r]=c*c;let l=r/e*13,u=n/e*13,d=1-Math.abs(Lr(l,u,13,3,t+811)*2-1);o[n*e+r]=d*d}let s=(t,n,r)=>t[(r%e+e)%e*e+(n%e+e)%e]??0;for(let t=0;t<e;t+=1)for(let c=0;c<e;c+=1){let l=s(a,c+1,t)-s(a,c-1,t),u=s(a,c,t+1)-s(a,c,t-1),d=s(o,c+1,t)-s(o,c-1,t),f=s(o,c,t+1)-s(o,c,t-1),p=(t*e+c)*4;n[p]=Math.round((Math.max(-1,Math.min(1,-l*r))*.5+.5)*255),n[p+1]=Math.round((Math.max(-1,Math.min(1,-u*r))*.5+.5)*255),n[p+2]=Math.round((Math.max(-1,Math.min(1,-d*i))*.5+.5)*255),n[p+3]=Math.round((Math.max(-1,Math.min(1,-f*i))*.5+.5)*255)}return Hr(new _(n,e,e,se,f))}function zr(e=512,t=4242){let n=new Uint8Array(e*e*4);for(let r=0;r<e;r+=1)for(let i=0;i<e;i+=1){let a=i/e*6,o=r/e*6,s=Lr(a*2,o*2,12,5,t,.55),c=Math.max(0,1-Math.abs(s*2-1))**1.6,l=Lr(a*7,o*7,42,3,t+313),u=Lr(a*.6,o*.6,4,2,t+77),d=(r*e+i)*4;n[d]=Math.round(Math.min(1,c)*255),n[d+1]=Math.round(l*255),n[d+2]=Math.round(u*255),n[d+3]=255}return Hr(new _(n,e,e,se,f))}function Br(e=256,t=9091){let n=new Uint8Array(e*e*4),r=(t,n,r)=>{let i=t/e*5,a=n/e*5,o=Lr(i,a,5,3,r,.6),s=Lr(i+.04,a,5,3,r,.6)-o,c=Lr(i,a+.04,5,3,r,.6)-o,l=1-Math.min(1,Math.hypot(s,c)*26);return Math.max(0,l)**4};for(let i=0;i<e;i+=1)for(let a=0;a<e;a+=1){let o=(i*e+a)*4;n[o]=Math.round(r(a,i,t)*255),n[o+1]=Math.round(r(a,i,t+1201)*255),n[o+2]=Math.round(r(a,i,t+2402)*255),n[o+3]=255}return Hr(new _(n,e,e,se,f))}function Vr(e=256,t=24,n=.5,r=5150){let i=new Uint8Array(e*e*4);for(let a=0;a<e;a+=1)for(let o=0;o<e;o+=1){let s=a/e*t,c=Math.floor(s),l=o/e*t+(c%2==0?0:.5),u=Math.floor(l),d=l-u,f=s-c,p=(d-.5)*2,m=(f-.5)*2,h=Math.sqrt(p*p+m*m*.55),g=Math.max(0,1-h),_=Math.min(1,h)**2.5,v=Pr(u,c,9973,r),y=.5+(v-.5)*n,b=(a*e+o)*4;i[b]=Math.round(g**.7*255),i[b+1]=Math.round((1-_*.85)*255),i[b+2]=Math.round(Math.max(0,Math.min(1,y))*255),i[b+3]=Math.round(v*255)}return Hr(new _(i,e,e,se,f))}function Hr(e){return e.wrapS=v,e.wrapT=v,e.minFilter=d,e.magFilter=I,e.generateMipmaps=!0,e.needsUpdate=!0,e}var Ur=`precision highp float;

#ifndef ENDLESS_FISHING_GERSTNER
#define ENDLESS_FISHING_GERSTNER

#ifndef MAX_WAVES
#define MAX_WAVES 8
#endif

uniform vec4 uWaveA[MAX_WAVES];
uniform vec4 uWaveB[MAX_WAVES];
uniform int uWaveCount;
uniform float uWaveTime;

vec3 gerstnerDisplacement(vec2 undisplaced) {
  vec3 displacement = vec3(0.0);

  for (int i = 0; i < MAX_WAVES; i++) {
    if (i >= uWaveCount) break;

    vec2 direction = uWaveA[i].xy;
    float amplitude = uWaveA[i].z;
    float wavenumber = uWaveA[i].w;
    float frequency = uWaveB[i].x;
    float phase = uWaveB[i].y;
    float steepness = uWaveB[i].z;

    float theta = wavenumber * dot(direction, undisplaced) - frequency * uWaveTime + phase;
    float cosTheta = cos(theta);
    float sinTheta = sin(theta);
    float pinch = steepness * amplitude;

    displacement.x += pinch * direction.x * cosTheta;
    displacement.y += amplitude * sinTheta;
    displacement.z += pinch * direction.y * cosTheta;
  }

  return displacement;
}

void gerstnerSurface(vec2 undisplaced, out vec3 normal, out float jacobian) {
  
  vec3 tangentX = vec3(1.0, 0.0, 0.0);
  vec3 tangentZ = vec3(0.0, 0.0, 1.0);

  for (int i = 0; i < MAX_WAVES; i++) {
    if (i >= uWaveCount) break;

    vec2 direction = uWaveA[i].xy;
    float amplitude = uWaveA[i].z;
    float wavenumber = uWaveA[i].w;
    float frequency = uWaveB[i].x;
    float phase = uWaveB[i].y;
    float steepness = uWaveB[i].z;

    float theta = wavenumber * dot(direction, undisplaced) - frequency * uWaveTime + phase;
    float cosTheta = cos(theta);
    float sinTheta = sin(theta);

    float pinch = steepness * amplitude * wavenumber;
    float slope = amplitude * wavenumber;

    tangentX.x -= pinch * direction.x * direction.x * sinTheta;
    tangentX.z -= pinch * direction.x * direction.y * sinTheta;
    tangentX.y += slope * direction.x * cosTheta;

    tangentZ.x -= pinch * direction.y * direction.x * sinTheta;
    tangentZ.z -= pinch * direction.y * direction.y * sinTheta;
    tangentZ.y += slope * direction.y * cosTheta;
  }

  normal = normalize(cross(tangentZ, tangentX));
  
  
  jacobian = tangentX.x * tangentZ.z - tangentX.z * tangentZ.x;
}

#endif

varying vec2 vUv;

uniform float uSampleExtent;

void main() {
  
  
  vec2 undisplaced = (vUv - 0.5) * uSampleExtent + vec2(37.317, -12.941);
  gl_FragColor = vec4(gerstnerDisplacement(undisplaced), 1.0);
}`,Wr=64,Gr=420;function Kr(e,t,n,r,a,o){let s=new Nt,c=new re(Wr,Wr,{type:De,minFilter:he,magFilter:he,depthBuffer:!1,stencilBuffer:!1,generateMipmaps:!1}),l=new i({vertexShader:Pt,fragmentShader:Ur,defines:{MAX_WAVES:r.length/4},uniforms:{uWaveA:{value:r},uWaveB:{value:a},uWaveCount:{value:o},uWaveTime:{value:n},uSampleExtent:{value:Gr}},depthTest:!1,depthWrite:!1});s.render(e,l,c);let u=new Float32Array(16384);e.readRenderTargetPixels(c,0,0,Wr,Wr,u);let d={x:0,y:0,z:0},f=0,p=0,m=1/0,h=-1/0,g={x:0,z:0};for(let e=0;e<Wr;e+=1)for(let r=0;r<Wr;r+=1){let i=(r+.5)/Wr,a=(e+.5)/Wr,o=(i-.5)*Gr+37.317,s=(a-.5)*Gr-12.941;t.evaluate(o,s,n,d);let c=(e*Wr+r)*4,l=u[c]??0,_=u[c+1]??0,v=u[c+2]??0,y=Math.abs(l-d.x),b=Math.abs(_-d.y),x=Math.abs(v-d.z),S=Math.max(y,b,x);S>f&&(f=S,g.x=o,g.z=s),p+=y*y+b*b+x*x,m=Math.min(m,d.y),h=Math.max(h,d.y)}l.dispose(),c.dispose(),s.dispose();let _=4096;return{samples:_,maxError:f,rmsError:Math.sqrt(p/(_*3)),worstAt:g,amplitudeRange:h-m}}var qr=`precision highp float;

#ifndef ENDLESS_FISHING_CONSTANTS\r
#define ENDLESS_FISHING_CONSTANTS

const float PI = 3.14159265358979323846;\r
const float TWO_PI = 6.28318530717958647692;\r
const float HALF_PI = 1.57079632679489661923;\r
const float INV_PI = 0.31830988618379067154;\r
const float INV_FOUR_PI = 0.07957747154594766788;\r
const float DEG_TO_RAD = 0.01745329251994329577;\r
const float RAD_TO_DEG = 57.2957795130823208768;

const float EPS = 1e-6;

#ifndef saturate\r
float saturate(float x) { return clamp(x, 0.0, 1.0); }\r
vec2 saturate(vec2 x) { return clamp(x, 0.0, 1.0); }\r
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }\r
#endif

float ef_luminance(vec3 colour) {\r
  return dot(colour, vec3(0.2126, 0.7152, 0.0722));\r
}

float remap(float x, float lowIn, float highIn, float lowOut, float highOut) {\r
  float span = highIn - lowIn;\r
  float t = span == 0.0 ? step(lowIn, x) : (x - lowIn) / span;\r
  return lowOut + saturate(t) * (highOut - lowOut);\r
}

vec3 hdrClamp(vec3 colour) {\r
  vec3 safe;\r
  safe.x = colour.x == colour.x ? colour.x : 0.0;\r
  safe.y = colour.y == colour.y ? colour.y : 0.0;\r
  safe.z = colour.z == colour.z ? colour.z : 0.0;\r
  
  
  return clamp(safe, vec3(0.0), vec3(60000.0));\r
}

float hdrClampAlpha(float alpha) {\r
  return clamp(alpha == alpha ? alpha : 0.0, 0.0, 1.0);\r
}

#endif
#ifndef ENDLESS_FISHING_GERSTNER
#define ENDLESS_FISHING_GERSTNER

#ifndef MAX_WAVES
#define MAX_WAVES 8
#endif

uniform vec4 uWaveA[MAX_WAVES];
uniform vec4 uWaveB[MAX_WAVES];
uniform int uWaveCount;
uniform float uWaveTime;

vec3 gerstnerDisplacement(vec2 undisplaced) {
  vec3 displacement = vec3(0.0);

  for (int i = 0; i < MAX_WAVES; i++) {
    if (i >= uWaveCount) break;

    vec2 direction = uWaveA[i].xy;
    float amplitude = uWaveA[i].z;
    float wavenumber = uWaveA[i].w;
    float frequency = uWaveB[i].x;
    float phase = uWaveB[i].y;
    float steepness = uWaveB[i].z;

    float theta = wavenumber * dot(direction, undisplaced) - frequency * uWaveTime + phase;
    float cosTheta = cos(theta);
    float sinTheta = sin(theta);
    float pinch = steepness * amplitude;

    displacement.x += pinch * direction.x * cosTheta;
    displacement.y += amplitude * sinTheta;
    displacement.z += pinch * direction.y * cosTheta;
  }

  return displacement;
}

void gerstnerSurface(vec2 undisplaced, out vec3 normal, out float jacobian) {
  
  vec3 tangentX = vec3(1.0, 0.0, 0.0);
  vec3 tangentZ = vec3(0.0, 0.0, 1.0);

  for (int i = 0; i < MAX_WAVES; i++) {
    if (i >= uWaveCount) break;

    vec2 direction = uWaveA[i].xy;
    float amplitude = uWaveA[i].z;
    float wavenumber = uWaveA[i].w;
    float frequency = uWaveB[i].x;
    float phase = uWaveB[i].y;
    float steepness = uWaveB[i].z;

    float theta = wavenumber * dot(direction, undisplaced) - frequency * uWaveTime + phase;
    float cosTheta = cos(theta);
    float sinTheta = sin(theta);

    float pinch = steepness * amplitude * wavenumber;
    float slope = amplitude * wavenumber;

    tangentX.x -= pinch * direction.x * direction.x * sinTheta;
    tangentX.z -= pinch * direction.x * direction.y * sinTheta;
    tangentX.y += slope * direction.x * cosTheta;

    tangentZ.x -= pinch * direction.y * direction.x * sinTheta;
    tangentZ.z -= pinch * direction.y * direction.y * sinTheta;
    tangentZ.y += slope * direction.y * cosTheta;
  }

  normal = normalize(cross(tangentZ, tangentX));
  
  
  jacobian = tangentX.x * tangentZ.z - tangentX.z * tangentZ.x;
}

#endif

attribute float aCellSize;
attribute float aRingExtent;

uniform vec2 uRingCentre;
uniform vec3 uCameraPosition;

uniform float uWaterLevel;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying float vJacobian;
varying float vViewDistance;
varying vec2 vUndisplaced;

const float MORPH_START = 0.72;

const float EARTH_RADIUS_M = 6371000.0;

void main() {
  vec2 local = position.xz;
  vec2 worldXZ = local + uRingCentre;

  
  
  vec2 fine = floor(worldXZ / aCellSize + 0.5) * aCellSize;
  vec2 coarse = floor(worldXZ / (aCellSize * 2.0) + 0.5) * (aCellSize * 2.0);

  
  
  
  float edgeDistance = max(abs(local.x), abs(local.y)) / aRingExtent;
  float morph = smoothstep(MORPH_START, 1.0, edgeDistance);

  
  
  vec2 undisplaced = mix(fine, coarse, morph);
  vUndisplaced = undisplaced;

  vec3 displacement = gerstnerDisplacement(undisplaced);

  vec3 normal;
  float jacobian;
  gerstnerSurface(undisplaced, normal, jacobian);

  vec3 world = vec3(
      undisplaced.x + displacement.x,
      uWaterLevel + displacement.y,
      undisplaced.y + displacement.z);

  vWorldPosition = world;
  vNormal = normal;
  vJacobian = jacobian;
  vViewDistance = distance(world, uCameraPosition);

  
  
  
  
  
  
  
  
  
  
  
  
  
  float horizontal = distance(world.xz, uCameraPosition.xz);
  vec3 projected = vec3(world.x, world.y - horizontal * horizontal / (2.0 * EARTH_RADIUS_M), world.z);

  gl_Position = projectionMatrix * viewMatrix * vec4(projected, 1.0);
}`,Jr=`precision highp float;

#ifndef ENDLESS_FISHING_CONSTANTS\r
#define ENDLESS_FISHING_CONSTANTS

const float PI = 3.14159265358979323846;\r
const float TWO_PI = 6.28318530717958647692;\r
const float HALF_PI = 1.57079632679489661923;\r
const float INV_PI = 0.31830988618379067154;\r
const float INV_FOUR_PI = 0.07957747154594766788;\r
const float DEG_TO_RAD = 0.01745329251994329577;\r
const float RAD_TO_DEG = 57.2957795130823208768;

const float EPS = 1e-6;

#ifndef saturate\r
float saturate(float x) { return clamp(x, 0.0, 1.0); }\r
vec2 saturate(vec2 x) { return clamp(x, 0.0, 1.0); }\r
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }\r
#endif

float ef_luminance(vec3 colour) {\r
  return dot(colour, vec3(0.2126, 0.7152, 0.0722));\r
}

float remap(float x, float lowIn, float highIn, float lowOut, float highOut) {\r
  float span = highIn - lowIn;\r
  float t = span == 0.0 ? step(lowIn, x) : (x - lowIn) / span;\r
  return lowOut + saturate(t) * (highOut - lowOut);\r
}

vec3 hdrClamp(vec3 colour) {\r
  vec3 safe;\r
  safe.x = colour.x == colour.x ? colour.x : 0.0;\r
  safe.y = colour.y == colour.y ? colour.y : 0.0;\r
  safe.z = colour.z == colour.z ? colour.z : 0.0;\r
  
  
  return clamp(safe, vec3(0.0), vec3(60000.0));\r
}

float hdrClampAlpha(float alpha) {\r
  return clamp(alpha == alpha ? alpha : 0.0, 0.0, 1.0);\r
}

#endif\r
#ifndef ENDLESS_FISHING_AIRLIGHT\r
#define ENDLESS_FISHING_AIRLIGHT

vec3 ef_airLight(samplerCube environment, float intensity, vec3 V) {\r
  vec3 direction = normalize(vec3(-V.x, max(-V.y, 0.07), -V.z) + vec3(EPS, 0.0, 0.0));\r
  return textureCubeLodEXT(environment, direction, 1.0).rgb * intensity;\r
}

#endif

varying vec3 vWorldPosition;\r
varying vec3 vNormal;\r
varying float vJacobian;\r
varying float vViewDistance;\r
varying vec2 vUndisplaced;

uniform vec3 uCameraPosition;\r
uniform float uTime;

uniform vec3 uSunDirection;\r
uniform vec3 uSunColour;\r
uniform float uSunIlluminance;\r
uniform vec3 uMoonDirection;\r
uniform vec3 uMoonColour;\r
uniform float uMoonIlluminance;

uniform float uSunAngularRadius;\r
uniform float uMoonAngularRadius;\r
uniform samplerCube uEnvironment;\r
uniform float uEnvironmentIntensity;

uniform sampler2D uDetailNormal;\r
uniform sampler2D uFoam;\r
uniform vec2 uWindDirection;\r
uniform float uWindSpeed;

uniform float uSeabedDepth;

uniform float uTurbidity;\r
uniform float uFoamAmount;

uniform float uVisibility;\r
uniform float uWaterLevel;

uniform sampler2D uRefraction;\r
uniform vec2 uResolution;\r
uniform float uRefractionStrength;

uniform sampler2D uCloudShadow;\r
uniform mat4 uCloudShadowMatrix;\r
uniform float uCloudShadowStrength;

float cloudShadowAt(vec3 worldPosition) {\r
  if (uCloudShadowStrength <= 0.0) return 1.0;\r
  vec2 uv = (uCloudShadowMatrix * vec4(worldPosition, 1.0)).xy;\r
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 1.0;\r
  float coverage = texture2D(uCloudShadow, uv).r;\r
  return mix(1.0, 1.0 - coverage, uCloudShadowStrength);\r
}\r

const vec3 ABSORPTION_OCEANIC = vec3(0.42, 0.072, 0.028);\r
const vec3 ABSORPTION_COASTAL = vec3(0.56, 0.19, 0.31);\r

const vec3 SCATTER_OCEANIC = vec3(0.010, 0.038, 0.055);\r
const vec3 SCATTER_COASTAL = vec3(0.028, 0.062, 0.048);\r

const float WATER_F0 = 0.0203;

vec3 fresnelSchlick(float cosTheta, float f0) {\r
  float m = clamp(1.0 - cosTheta, 0.0, 1.0);\r
  float m2 = m * m;\r
  return vec3(f0 + (1.0 - f0) * m2 * m2 * m);\r
}\r

float distributionGGX(float nDotH, float roughness) {\r
  float a = roughness * roughness;\r
  float a2 = a * a;\r
  float d = nDotH * nDotH * (a2 - 1.0) + 1.0;\r
  return a2 / max(EPS, PI * d * d);\r
}

float smithGGX(float nDotV, float nDotL, float roughness) {\r
  float a = roughness * roughness;\r
  float k = a * 0.5;\r
  float gv = nDotV / (nDotV * (1.0 - k) + k);\r
  float gl = nDotL / (nDotL * (1.0 - k) + k);\r
  return gv * gl;\r
}\r

vec3 detailNormal(vec2 worldXZ, float distanceToCamera, float windFactor) {\r
  vec2 drift = uWindDirection * uTime * (0.35 + uWindSpeed * 0.05);

  vec4 a = texture2D(uDetailNormal, worldXZ * 0.055 + drift * 0.02);\r
  vec4 b = texture2D(uDetailNormal, worldXZ * 0.21 - drift * 0.045);

  vec2 slopeA = (a.rg * 2.0 - 1.0);\r
  vec2 slopeB = (b.ba * 2.0 - 1.0);

  float fadeA = 1.0 - smoothstep(180.0, 900.0, distanceToCamera);\r
  float fadeB = 1.0 - smoothstep(40.0, 260.0, distanceToCamera);

  vec2 slope = (slopeA * fadeA * 0.65 + slopeB * fadeB * 0.45) * windFactor;\r
  return normalize(vec3(slope.x, 1.0, slope.y));\r
}

void main() {\r
  vec3 viewVector = uCameraPosition - vWorldPosition;\r
  float viewDistance = length(viewVector);\r
  vec3 V = viewVector / max(EPS, viewDistance);

  
  float windFactor = smoothstep(0.4, 5.0, uWindSpeed);

  
  
  
  
  
  
  
  
  float unresolvedSlope = smoothstep(260.0, 2600.0, viewDistance);\r
  
  
  
  
  
  
  
  
  
  float flatten = unresolvedSlope * mix(0.88, 1.0, smoothstep(1500.0, 4000.0, viewDistance));\r
  vec3 geometricNormal = normalize(mix(normalize(vNormal), vec3(0.0, 1.0, 0.0), flatten));\r
  vec3 ripple = detailNormal(vUndisplaced, viewDistance, windFactor);\r
  
  
  vec3 N = normalize(vec3(\r
      geometricNormal.x + ripple.x,\r
      geometricNormal.y * ripple.y,\r
      geometricNormal.z + ripple.z));

  float nDotV = max(1e-3, dot(N, V));

  
  
  
  
  
  float compression = clamp(1.0 - vJacobian, 0.0, 2.0);\r
  float whitecapThreshold = mix(0.62, 0.22, smoothstep(4.0, 20.0, uWindSpeed));\r
  float crestFoam = smoothstep(whitecapThreshold, whitecapThreshold + 0.34, compression);

  vec4 foamSample = texture2D(uFoam, vUndisplaced * 0.09);\r
  float foamBreakup = foamSample.r * (0.55 + 0.45 * foamSample.b);\r
  float foamMask = clamp(crestFoam * uFoamAmount * (0.35 + foamBreakup), 0.0, 1.0);\r
  
  
  foamMask *= smoothstep(0.0, 0.35, foamMask + foamSample.g * 0.35 - 0.18);

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  float whitecapCoverage = clamp(3.84e-6 * pow(max(1.0, uWindSpeed), 3.41), 0.0, 0.3) * uFoamAmount;\r
  foamMask = mix(foamMask, whitecapCoverage, smoothstep(1200.0, 4200.0, viewDistance));

  
  vec3 R = reflect(-V, N);\r
  
  
  R.y = max(R.y, 0.008);

  
  
  
  
  float unresolved = smoothstep(30.0, 1400.0, viewDistance);\r
  
  
  float roughness = mix(0.028, 0.11 + 0.20 * windFactor, unresolved);\r
  roughness = mix(roughness, 0.34, unresolvedSlope);\r
  roughness = mix(roughness, 0.6, foamMask);

  
  float mip = roughness * 7.0;\r
  vec3 reflection = textureCubeLodEXT(uEnvironment, R, mip).rgb * uEnvironmentIntensity;

  vec3 fresnel = fresnelSchlick(nDotV, WATER_F0);

  
  vec2 screenUv = gl_FragCoord.xy / uResolution;\r
  
  
  float distortionScale = uRefractionStrength / (1.0 + viewDistance * 0.06);\r
  vec2 refractedUv = clamp(screenUv + N.xz * distortionScale, vec2(0.002), vec2(0.998));\r
  vec3 behind = texture2D(uRefraction, refractedUv).rgb;

  
  
  
  float pathLength = uSeabedDepth / max(0.12, nDotV);\r
  vec3 absorption = mix(ABSORPTION_OCEANIC, ABSORPTION_COASTAL, uTurbidity);\r
  vec3 scatterColour = mix(SCATTER_OCEANIC, SCATTER_COASTAL, uTurbidity);\r
  vec3 transmittance = exp(-absorption * pathLength);

  
  vec3 skyAbove = textureCubeLodEXT(uEnvironment, vec3(0.0, 1.0, 0.0), 5.0).rgb * uEnvironmentIntensity;\r
  vec3 sunlight = uSunColour * uSunIlluminance + uMoonColour * uMoonIlluminance;\r
  vec3 upwelling = scatterColour * (skyAbove * 0.55 + sunlight * 0.35 * max(0.0, uSunDirection.y));\r
  vec3 refracted = behind * transmittance + upwelling * (1.0 - transmittance);

  
  vec3 specular = vec3(0.0);\r
  vec3 subsurface = vec3(0.0);\r
  float sunShadow = cloudShadowAt(vWorldPosition);

  
  
  for (int light = 0; light < 2; light++) {\r
    vec3 L = light == 0 ? uSunDirection : uMoonDirection;\r
    vec3 colour = light == 0 ? uSunColour : uMoonColour;\r
    float sourceRadius = light == 0 ? uSunAngularRadius : uMoonAngularRadius;\r
    
    
    float illuminance = (light == 0 ? uSunIlluminance * sunShadow : uMoonIlluminance);\r
    
    
    
    
    float aboveHorizon = smoothstep(-0.018, 0.0, L.y);\r
    illuminance *= aboveHorizon;\r
    if (illuminance <= 0.0) continue;

    vec3 H = normalize(L + V);\r
    float nDotL = max(0.0, dot(N, L));\r
    float nDotH = max(0.0, dot(N, H));

    
    
    
    
    
    
    
    
    
    
    
    float alpha = roughness * roughness;\r
    float alphaPrime = clamp(alpha + sourceRadius * 0.5, alpha, 1.0);\r
    float sphereEnergy = (alpha / alphaPrime) * (alpha / alphaPrime);

    float D = distributionGGX(nDotH, sqrt(alphaPrime)) * sphereEnergy;\r
    float G = smithGGX(nDotV, max(1e-3, nDotL), roughness);\r
    vec3 F = fresnelSchlick(max(0.0, dot(H, V)), WATER_F0);\r
    specular += (D * G / (4.0 * nDotV * max(1e-3, nDotL) + EPS)) * F * colour * illuminance * nDotL;

    
    
    float backlight = pow(max(0.0, dot(V, -L)), 3.5);\r
    float crestHeight = clamp((vWorldPosition.y - uWaterLevel) * 0.55 + 0.35, 0.0, 1.0);\r
    float thinness = pow(crestHeight, 2.0) * max(0.0, 1.0 - abs(L.y) * 1.6);\r
    subsurface += colour * illuminance * backlight * thinness * 0.16;\r
  }

  
  
  subsurface *= vec3(0.32, 0.78, 0.62);

  
  vec3 water = mix(refracted, reflection, fresnel) + specular + subsurface;

  
  
  vec3 foamAmbient = skyAbove * 0.42;\r
  vec3 foamDirect = sunlight * 0.16 * max(0.0, dot(N, uSunDirection));\r
  vec3 foamColour = (foamAmbient + foamDirect) * vec3(0.94, 0.96, 0.97);\r
  vec3 colour = mix(water, foamColour, foamMask);

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  float hazeExtinction = 3.912 / max(200.0, uVisibility);\r
  float haze = 1.0 - exp(-hazeExtinction * viewDistance);\r
  colour = mix(colour, ef_airLight(uEnvironment, uEnvironmentIntensity, V), haze);

  gl_FragColor = vec4(hdrClamp(colour), 1.0);\r
}`,Yr=8,Xr=.55,Zr=55,Qr=32e3,$r=class{name=`ocean`;priority=10;mesh;material;geometry;bank;waveTime=0;waveA=new Float32Array(32);waveB=new Float32Array(32);scratch={x:0,y:0,z:0};refraction;refractionScale;detailNormal;foamTexture;spectrum;constructor(n){let r=n.settings.graphics;this.spectrum={windSpeed:6,windDirection:0,fetchKm:n.world.fetchKm,waveCount:r.waveCount,seed:n.settings.world.seed,spreading:10,amplitudeScale:1},this.bank=new Mr(this.spectrum),this.detailNormal=n.resources.track(Rr(512,n.settings.world.seed)),this.foamTexture=n.resources.track(zr(512,n.settings.world.seed^40503)),this.refractionScale=r.refractionScale,this.refraction=ri(1,1),this.material=new i({vertexShader:qr,fragmentShader:Jr,defines:{MAX_WAVES:Yr},uniforms:{uWaveA:{value:this.waveA},uWaveB:{value:this.waveB},uWaveCount:{value:0},uWaveTime:{value:0},uRingCentre:{value:new x},uCameraPosition:{value:new t},uWaterLevel:{value:0},uTime:{value:0},uSunDirection:{value:new t(0,1,0)},uSunColour:{value:new a(1,1,1)},uSunIlluminance:{value:1},uMoonDirection:{value:new t(0,-1,0)},uMoonColour:{value:new a(.72,.8,1)},uMoonIlluminance:{value:0},uSunAngularRadius:{value:.00465},uMoonAngularRadius:{value:.00452},uEnvironment:{value:null},uEnvironmentIntensity:{value:1},uDetailNormal:{value:this.detailNormal},uFoam:{value:this.foamTexture},uWindDirection:{value:new x(1,0)},uWindSpeed:{value:6},uSeabedDepth:{value:Zr},uTurbidity:{value:.15},uFoamAmount:{value:1},uVisibility:{value:25e3},uRefraction:{value:this.refraction.texture},uResolution:{value:new x(1,1)},uRefractionStrength:{value:.06},uCloudShadow:{value:null},uCloudShadowMatrix:{value:new b},uCloudShadowStrength:{value:0}},side:2,transparent:!1,depthWrite:!0}),this.geometry=ii(r.oceanGridResolution,ti(r.oceanGridResolution,r.oceanRings),Xr),this.mesh=new e(this.geometry,this.material),this.mesh.frustumCulled=!1,this.mesh.renderOrder=0,this.mesh.receiveShadow=!0,this.uploadBank(),n.scene.add(this.mesh)}setCloudShadows(e){this.cloudShadows=e}cloudShadows=null;get significantWaveHeight(){return this.bank.significantWaveHeight}get peakPeriod(){return this.bank.peakPeriod}get waveBank(){return this.bank}heightAt(e,t){return this.waterLevel+this.bank.heightAt(e,t,this.waveTime,this.scratch)}parityCheck(e){let t=this.material.uniforms.uWaveCount,n=typeof t?.value==`number`?t.value:0;return Kr(e.renderer,this.bank,this.waveTime,this.waveA,this.waveB,n)}normalAt(e,t,n){return this.bank.normalAt(e,t,this.waveTime,this.scratch),n.set(this.scratch.x,this.scratch.y,this.scratch.z)}waterLevel=0;fixedUpdate(e){this.waveTime+=e}update(e,t){let n=t.world;this.waterLevel=n.tideHeight,this.rebuildIfNeeded(t);let r=this.material.uniforms;ei(r,`uWaveTime`,this.waveTime),ei(r,`uTime`,t.loop.elapsed),ei(r,`uWaterLevel`,this.waterLevel),ei(r,`uWindSpeed`,n.windSpeed),ei(r,`uFoamAmount`,1),ei(r,`uVisibility`,n.visibility);let i=r.uRingCentre;i!==void 0&&i.value.set(t.camera.position.x,t.camera.position.z);let a=r.uCameraPosition;a!==void 0&&a.value.copy(t.camera.position);let o=r.uWindDirection;if(o!==void 0){let e=Math.hypot(n.windX,n.windZ)||1;o.value.set(n.windX/e,n.windZ/e)}let s=n.ephemeris;if(s!==null){let e=r.uSunDirection;e!==void 0&&e.value.set(s.sunDirectionRefracted.x,s.sunDirectionRefracted.y,s.sunDirectionRefracted.z);let t=r.uMoonDirection;t!==void 0&&t.value.set(s.moonDirection.x,s.moonDirection.y,s.moonDirection.z),ei(r,`uSunIlluminance`,s.sunIlluminanceLux/Math.PI*(1-n.cloudiness*.9)),ei(r,`uMoonIlluminance`,s.moonIlluminanceLux/Math.PI),ei(r,`uSunAngularRadius`,s.sun.angularRadius),ei(r,`uMoonAngularRadius`,s.moon.angularRadius)}}beforeRender(e){let t=Math.max(2,Math.round(e.width*e.pixelRatio*this.refractionScale)),n=Math.max(2,Math.round(e.height*e.pixelRatio*this.refractionScale));(this.refraction.width!==t||this.refraction.height!==n)&&this.refraction.setSize(t,n);let r=e.renderer.getRenderTarget();this.mesh.visible=!1,e.renderer.setRenderTarget(this.refraction),e.renderer.clear(),e.renderer.render(e.scene,e.camera),e.renderer.setRenderTarget(r),this.mesh.visible=!0;let i=this.material.uniforms,a=i.uResolution;a!==void 0&&a.value.set(e.width*e.pixelRatio,e.height*e.pixelRatio);let o=e.get(`sky`),s=i.uEnvironment;s!==void 0&&o!==void 0&&(s.value=o.probe.cubeTexture);let c=this.cloudShadows?.shadowTexture??null,l=i.uCloudShadow;l!==void 0&&(l.value=c);let u=i.uCloudShadowMatrix;u!==void 0&&this.cloudShadows!==null&&u.value.copy(this.cloudShadows.shadowMatrix);let d=i.uCloudShadowStrength;d!==void 0&&(d.value=c===null?0:1-e.world.cloudiness*.85)}onSettingsChanged(e){let t=e.settings.graphics;this.refractionScale=t.refractionScale;let n=ii(t.oceanGridResolution,ti(t.oceanGridResolution,t.oceanRings),Xr);this.geometry.dispose(),this.geometry=n,this.mesh.geometry=n,t.waveCount!==this.spectrum.waveCount&&(this.spectrum={...this.spectrum,waveCount:t.waveCount},this.bank=new Mr(this.spectrum),this.uploadBank())}dispose(){this.geometry.dispose(),this.material.dispose(),this.refraction.dispose()}rebuildIfNeeded(e){let t=e.world,n=Math.atan2(t.windX,-t.windZ),r=Math.abs(t.windSpeed-this.spectrum.windSpeed)>.6,i=Math.abs(ni(n,this.spectrum.windDirection))>.12,a=Math.abs(t.fetchKm-this.spectrum.fetchKm)>40;if(t.beaufort=st(t.windSpeed),!r&&!i&&!a){t.significantWaveHeight=this.bank.significantWaveHeight;return}this.spectrum={...this.spectrum,windSpeed:t.windSpeed,windDirection:n,fetchKm:t.fetchKm,spreading:14-Math.min(9,st(t.windSpeed))},this.bank=new Mr(this.spectrum),this.uploadBank(),t.significantWaveHeight=this.bank.significantWaveHeight}uploadBank(){this.waveA.fill(0),this.waveB.fill(0);let e=new Float32Array(64),t=this.bank.toUniformArray(e);this.waveA.set(e.subarray(0,t*4)),this.waveB.set(e.subarray(t*4,t*8)),ei(this.material.uniforms,`uWaveCount`,t)}};function ei(e,t,n){let r=e[t];r!==void 0&&(r.value=n)}function ti(e,t){let n=Math.max(16,Math.floor(e/2)*2),r=Math.max(1,t);for(;n*Xr*2**(r-1)/2<Qr;)r+=1;return r}function ni(e,t){let n=(e-t)%(Math.PI*2);return n>Math.PI&&(n-=Math.PI*2),n<=-Math.PI&&(n+=Math.PI*2),n}function ri(e,t){return new re(e,t,{type:E,minFilter:I,magFilter:I,depthBuffer:!0,stencilBuffer:!1,generateMipmaps:!1})}function ii(e,t,n){let r=[],i=[],a=[],o=[],s=Math.max(16,Math.floor(e/2)*2);for(let e=0;e<t;e+=1){let t=n*2**e,c=s*t/2,l=e===0?0:c/2,u=r.length/3,d=s+1;for(let e=0;e<=s;e+=1){let n=-c+e*t;for(let e=0;e<=s;e+=1){let o=-c+e*t;r.push(o,0,n),i.push(t),a.push(c)}}for(let e=0;e<s;e+=1)for(let n=0;n<s;n+=1){let r=-c+n*t,i=-c+e*t,a=r+t,s=i+t;if(l>0&&Math.max(Math.abs(r),Math.abs(a))<=l&&Math.max(Math.abs(i),Math.abs(s))<=l)continue;let f=u+e*d+n,p=f+1,m=f+d,h=m+1;o.push(f,m,p,p,m,h)}}let c=new L;return c.setAttribute(`position`,new j(new Float32Array(r),3)),c.setAttribute(`aCellSize`,new j(new Float32Array(i),1)),c.setAttribute(`aRingExtent`,new j(new Float32Array(a),1)),c.setIndex(o),c.boundingSphere=null,c}var ai=6371e3,oi=.0123000371,si=332946.0487,ci=149597870700,li=3.2,ui=1.8,di=38,fi=6;function pi(e,t,n,r,i){let a=ai/t,o=e*a*a*a*ai,s=Math.sin(n)*Math.sin(r)+Math.cos(n)*Math.cos(r)*Math.cos(i);return o*1.5*(s*s-1/3)}function mi(e,t){let n=ar(e-ui*36e5,t),r=t.latitudeDeg*Math.PI/180,i=n.moon.equatorial,a=n.sun.equatorial;return(pi(oi,n.moon.distanceKm*1e3,r,i.declination,pn(n.siderealTime,i.rightAscension))+pi(si,n.sun.distanceAu*ci,r,a.declination,pn(n.siderealTime,a.rightAscension)))*li}function hi(e,t,n=di,r=fi){let i=r*6e4,a=Math.max(3,Math.ceil(n*60/r)),o=[],s=mi(e-i,t),c=mi(e,t);for(let n=1;n<=a;n+=1){let r=e+n*i,a=mi(r,t),l=c>s;if(l===c>a){let e=s-2*c+a,n=e===0?0:.5*(s-a)/e,u=r-i+n*i;o.push({epochMs:u,heightM:mi(u,t),kind:l?`high`:`low`})}s=c,c=a}return o}var gi=class{name=`tides`;priority=5;events=[];forecastEpochMs=0;location={latitudeDeg:0,longitudeDeg:0,elevationM:0};height=0;lastHeight=0;high=0;low=0;get heightM(){return this.height}get highWaterMarkM(){return this.high}get lowWaterMarkM(){return this.low}get direction(){return this.height>=this.lastHeight?`flood`:`ebb`}nextHighWater(){return this.nextOf(`high`)}nextLowWater(){return this.nextOf(`low`)}get forecast(){return this.events}update(e,t){let n=t.settings.world,r=t.time.epochMs,i=this.events[0];(i===void 0||i.epochMs<=r||Math.abs(r-this.forecastEpochMs)>216e5||this.location.latitudeDeg!==n.latitudeDeg||this.location.longitudeDeg!==n.longitudeDeg)&&(this.location={latitudeDeg:n.latitudeDeg,longitudeDeg:n.longitudeDeg,elevationM:0},this.forecastEpochMs=r,this.events=hi(r,this.location),this.refreshMarks()),this.lastHeight=this.height,this.height=mi(r,this.location),t.world.tideHeight=this.height}nextOf(e){for(let t of this.events)if(t.kind===e)return t;return null}refreshMarks(){let e=0,t=0;for(let n of this.events)n.heightM>e&&(e=n.heightM),n.heightM<t&&(t=n.heightM);this.high=e,this.low=t}},_i=[.5,1.5,3.3,5.5,7.9,10.7,13.8,17.1,20.7,24.4,28.4,32.6];function vi(e){let t=Math.max(0,e),n=0;for(let e=0;e<_i.length;e+=1){let r=_i[e];if(r===void 0)break;if(t<r)return e+(t-n)/(r-n);n=r}return 12}var yi=[{name:`dead-calm`,family:`clear`,beaufortLow:0,beaufortHigh:1,cloudiness:.1,precipitation:0,visibilityM:3e4,label:`Dead calm`},{name:`light-breeze`,family:`clear`,beaufortLow:2,beaufortHigh:3,cloudiness:.22,precipitation:0,visibilityM:27e3,label:`Light breeze`},{name:`partly-cloudy`,family:`partly-cloudy`,beaufortLow:3,beaufortHigh:4,cloudiness:.5,precipitation:0,visibilityM:23e3,label:`Partly cloudy`},{name:`overcast`,family:`overcast`,beaufortLow:3,beaufortHigh:5,cloudiness:.88,precipitation:.05,visibilityM:15e3,label:`Overcast`},{name:`fog`,family:`fog`,beaufortLow:0,beaufortHigh:2,cloudiness:.7,precipitation:0,visibilityM:120,label:`Sea fog`},{name:`rain`,family:`overcast`,beaufortLow:4,beaufortHigh:5,cloudiness:.95,precipitation:.55,visibilityM:4500,label:`Rain`},{name:`thunderstorm`,family:`storm`,beaufortLow:5,beaufortHigh:7,cloudiness:.97,precipitation:.8,visibilityM:2400,label:`Thunderstorm`},{name:`storm`,family:`storm`,beaufortLow:8,beaufortHigh:10,cloudiness:.98,precipitation:.85,visibilityM:1400,label:`Storm`}];function bi(e){return e===`storm`||e===`thunderstorm`}var xi=75,Si=2900,Ci=30,wi=1013.25,Ti=46,Ei=64,Di=3e4,Oi=1,ki=1.225,Ai=72921159e-12,ji=16,Mi=.72,Ni=.3,Pi=26.5,Fi=26,Ii=.34,Li=3.5,Ri=12.5,zi=9.80665,Bi=22800,Vi=Bi/71500,Hi=36,Ui=25,Wi=700;function Gi(e){return G(Bi*e*e/zi*.001,Ui,Wi)}var Ki=Math.PI/180,qi=.035,Ji=.05,Yi=.006,Xi=.01,Zi=.008,Qi=.008,$i=.005,ea=.02,ta=4.2,na=1.8,ra=6.6,ia=6,aa=4,oa=384,sa=5,ca=24,la=Si*1e3*2,ua=276,da=.06,fa=.55,pa=25;function ma(){return{pressureHpa:wi,trendHpaPerHour:0,windX:0,windZ:0,windSpeed:0,windDirection:0,cloudiness:.2,precipitation:0,fogginess:0,instability:0,temperatureC:12,visibilityM:25e3}}var ha=30,ga=20;function _a(e,t,n){return W(t-n,t+n,e)}function va(e,t,n){return W(t+n,t-n,e)}function ya(e,t,n,r){return Math.min(_a(e,t,r),va(e,n,r))}function ba(e,t,n){return Math.min(W(t-2,t-.5,e),W(n+2,n+.5,e))}function xa(e,t,n){let r=va(n.precipitation,.14,.08),i=va(n.fogginess,.42,.18);switch(e){case`dead-calm`:return Sa(t,0,1,va(n.cloudiness,.8,.2)*r*i);case`light-breeze`:return Sa(t,2,3,va(n.cloudiness,.5,.18)*r*i);case`partly-cloudy`:return Sa(t,3,4,ya(n.cloudiness,.3,.72,.12)*r*i);case`overcast`:return Sa(t,3,5,_a(n.cloudiness,.7,.12)*va(n.precipitation,.2,.1)*i);case`fog`:return Sa(t,0,2,_a(n.fogginess,.42,.18));case`rain`:return Sa(t,4,5,_a(n.precipitation,.2,.12)*va(n.instability,.6,.15));case`thunderstorm`:return Sa(t,5,7,_a(n.precipitation,.25,.15)*_a(n.instability,.62,.14));case`storm`:return Sa(t,8,10,_a(n.cloudiness,.55,.2))}}function Sa(e,t,n,r){return ba(e,t,n)*(.06+.94*r)}function Ca(e,t,n,r,i,a){let o=i/(Si*1e3);return G(e.fbm3(t*o,n*o,r/(Ti*a),3,2,.5)*.5+.5,0,1)}function wa(e){return((e.beaufortLow===0?0:_i[e.beaufortLow-1]??0)+(_i[e.beaufortHigh]??Pi))*.5}function Ta(e,t){t.pressureHpa=e.pressureHpa,t.trendHpaPerHour=e.trendHpaPerHour,t.windX=e.windX,t.windZ=e.windZ,t.windSpeed=e.windSpeed,t.windDirection=e.windDirection,t.cloudiness=e.cloudiness,t.precipitation=e.precipitation,t.fogginess=e.fogginess,t.instability=e.instability,t.temperatureC=e.temperatureC,t.visibilityM=e.visibilityM}function Ea(e,t,n){e.windX=K(e.windX,t.windX,qi,n),e.windZ=K(e.windZ,t.windZ,qi,n),e.windSpeed=Math.hypot(e.windX,e.windZ),e.windDirection=Math.atan2(e.windX,-e.windZ),e.pressureHpa=t.pressureHpa,e.trendHpaPerHour=K(e.trendHpaPerHour,t.trendHpaPerHour,Ji,n),e.cloudiness=K(e.cloudiness,t.cloudiness,Yi,n),e.precipitation=K(e.precipitation,t.precipitation,Xi,n),e.fogginess=K(e.fogginess,t.fogginess,Zi,n),e.instability=K(e.instability,t.instability,Qi,n),e.temperatureC=K(e.temperatureC,t.temperatureC,$i,n),e.visibilityM=K(e.visibilityM,t.visibilityM,ea,n)}var Da=class{current=ma();target=ma();pressureNoise;moistureNoise;warmthNoise;probeScratch=ma();forecastState=ma();scores=new Float64Array(yi.length);seed;originX=0;originZ=0;originHours=0;originSeeded=!1;geostrophicPerUnit=1;hemisphere=1;latitudeDeg=NaN;steeringU;steeringV;elapsedSeconds=0;fetchKm=200;fetchX=0;fetchZ=0;primed=!1;override=null;stateIndex=1;neighbourIndex=1;blendValue=0;constructor(e,t){this.seed=e,this.pressureNoise=new mr(e),this.moistureNoise=new mr((e^2654435769)>>>0),this.warmthNoise=new mr((e^2246822507)>>>0);let n=new H((e^668265263)>>>0).next()*Math.PI*2,r=Ei/Si;this.steeringU=Math.cos(n)*r,this.steeringV=Math.sin(n)*r,this.setLatitude(t),this.seedOrigin()}get synopticHours(){return this.elapsedSeconds/xi}get descriptor(){return yi[this.stateIndex]??Oa}get state(){return this.descriptor.name}get neighbour(){return yi[this.neighbourIndex]??this.descriptor}get blend(){return this.blendValue}get fetch(){return this.fetchKm}scoreAt(e){return this.scores[e]??0}setLatitude(e){if(e===this.latitudeDeg)return;this.latitudeDeg=e,this.hemisphere=e<0?-1:1;let t=2*Ai*Math.sin(Math.max(ji,Math.abs(e))*Ki);this.geostrophicPerUnit=.001/(ki*t),this.originSeeded&&this.elapsedSeconds<pa&&this.seedOrigin()}seedOrigin(){this.originX=0,this.originZ=0,this.originHours=0;let e=new H((this.seed^1799596529)>>>0),t=0,n=0,r=0,i=-1/0;for(let a=0;a<oa;a+=1){let a=(e.next()*2-1)*la,o=(e.next()*2-1)*la,s=(e.next()*2-1)*ua,c=this.scoreOrigin(a,o,s);c>i&&(i=c,t=a,n=o,r=s)}let a=la*da,o=ua*da;for(let s=0;s<sa;s+=1){for(let s=0;s<ca;s+=1){let s=t+(e.next()*2-1)*a,c=n+(e.next()*2-1)*a,l=r+(e.next()*2-1)*o,u=this.scoreOrigin(s,c,l);u>i&&(i=u,t=s,n=c,r=l)}a*=fa,o*=fa}this.originX=t,this.originZ=n,this.originHours=r,this.originSeeded=!0}scoreOrigin(e,t,n){let r=this.probeScratch,i=0,a=!0;for(let o=0;o<=aa;o+=1){let s=o/aa*ia;this.probeField(e,t,n+s,r);let c=r.windSpeed,l=o===0?1:.35,u=c-ta;if(i-=l*u*u,i-=l*6*r.precipitation,i-=l*5*r.fogginess,i-=l*3*Math.max(0,r.cloudiness-.6),(c<na||c>ra)&&(a=!1),o===0){let e=r.pressureHpa-wi;i+=2*G(e/12,-1,1),i-=1.5*Math.max(0,-r.trendHpaPerHour),e<=0&&(a=!1)}}return a?i+1e3:i}setOverride(e){let t=this.override;e!==(t===null?null:t.name)&&(this.override=e===null?null:yi.find(t=>t.name===e)??null)}pressureAt(e,t,n){return this.pressureField(e+this.originX,t+this.originZ,n+this.originHours)}probeAt(e,t,n,r){this.probeField(e+this.originX,t+this.originZ,n+this.originHours,r)}pressureField(e,t,n){let r=1/(Si*1e3),i=e*r+this.steeringU*n,a=t*r+this.steeringV*n,o=n/Ti,s=this.pressureNoise.fbm3(i,a,o,3,2,.42);return wi+Ci*s*(.42+.58*s*s)}probeField(e,t,n,r){let i=Di,a=this.pressureField(e,t,n),o=this.pressureField(e+i,t,n),s=this.pressureField(e-i,t,n),c=this.pressureField(e,t+i,n),l=this.pressureField(e,t-i,n),u=this.pressureField(e,t,n-Oi),d=(o-s)/(2*i)*1e5,f=(l-c)/(2*i)*1e5,p=this.geostrophicPerUnit*this.hemisphere,m=-f*p,h=d*p,g=Ni*this.hemisphere,_=Math.cos(g),v=Math.sin(g),y=m*_-h*v,b=m*v+h*_,x=Math.hypot(y,b),S=Math.min(x*Mi,Pi),C=x>1e-6?1/x:0,w=y*C,T=b*C;r.pressureHpa=a,r.trendHpaPerHour=(a-u)/Oi,r.windX=w*S,r.windZ=-T*S,r.windSpeed=S,r.windDirection=Math.atan2(w,T);let E=Ca(this.moistureNoise,e,t,n,.62,1.4),D=Ca(this.warmthNoise,e,t,n,.38,2.1),O=a-wi,ee=r.trendHpaPerHour,k=G(G(.5-O/Fi,0,1)+G(-ee*Ii,-.2,.45)+(E-.5)*.3,0,1),te=G(W(.74,.96,k)*W(0,-.9,ee)*(.25+.75*E),0,1),A=G((E*1.15+D*.55-.5-O/45)*W(.5,.85,k),0,1),j=G(W(4.6,1.4,S)*W(.44,.74,E)*(1-W(.02,.2,te)),0,1);r.cloudiness=k,r.precipitation=te,r.instability=A,r.fogginess=j,r.temperatureC=Li+Ri*D-2.2*te,r.visibilityM=hr((34e3-12e3*E)/(1+te*8),90,W(.3,.95,j))}step(e,t,n){let r=Math.max(0,e);this.elapsedSeconds+=r,this.probeAt(t,n,this.synopticHours,this.target),this.applyOverride(this.target);let i=this.current;if(this.primed)Ea(i,this.target,r);else{this.primed=!0,Ta(this.target,i),this.fetchKm=Gi(i.windSpeed);let e=i.windSpeed>1e-4?this.fetchKm/i.windSpeed:0;this.fetchX=i.windX*e,this.fetchZ=i.windZ*e}this.updateFetch(r),this.classify(i,!0)}applyOverride(e){let t=this.override;if(t===null)return;let n=wa(t);if(e.windSpeed>1e-4){let t=n/e.windSpeed;e.windX*=t,e.windZ*=t}else e.windX=Math.sin(e.windDirection)*n,e.windZ=-Math.cos(e.windDirection)*n;e.windSpeed=n,e.cloudiness=t.cloudiness,e.precipitation=t.precipitation,e.visibilityM=t.visibilityM,e.fogginess=t.name===`fog`?.95:0,e.instability=t.name===`thunderstorm`?.9:0}updateFetch(e){let t=this.current.windSpeed,n=Gi(t),r=3600/xi*e,i=Math.hypot(this.fetchX,this.fetchZ);if(t>1e-4){let e=t*Vi*r*.001;this.fetchX+=this.current.windX/t*e,this.fetchZ+=this.current.windZ/t*e}let a=G(n+Math.max(0,i-n)*Math.exp(-r/(Hi*3600)),Ui,Wi),o=Math.hypot(this.fetchX,this.fetchZ);if(o>a&&o>1e-6){let e=a/o;this.fetchX*=e,this.fetchZ*=e}this.fetchKm=G(Math.min(o,a),Ui,Wi)}classify(e,t){let n=vi(e.windSpeed),r=0,i=-1,a=0,o=-1;for(let s=0;s<yi.length;s+=1){let c=yi[s],l=c===void 0?0:xa(c.name,n,e);t&&(this.scores[s]=l),l>i?(o=i,a=r,i=l,r=s):l>o&&(o=l,a=s)}if(!t)return r;let s=this.override;if(s!==null){let e=yi.indexOf(s);return this.stateIndex=e<0?r:e,this.neighbourIndex=this.stateIndex,this.blendValue=0,this.stateIndex}return this.stateIndex=r,this.neighbourIndex=a,this.blendValue=i>1e-6?G(o/i,0,1):0,r}forecast(e,t,n){let r=this.override;if(r!==null){let e=bi(r.name);n.approaching=e,n.minutesAway=e?0:ha;return}let i=this.forecastState;Ta(this.current,i);let a=ha/ga,o=a*60,s=60/xi;for(let r=0;r<=ga;r+=1){let c=r*a;if(r>0){let n=this.synopticHours+c*s;this.probeAt(e,t,n,this.probeScratch),Ea(i,this.probeScratch,o)}let l=yi[this.classify(i,!1)]?.name;if(l!==void 0&&bi(l)){n.approaching=!0,n.minutesAway=c;return}}n.approaching=!1,n.minutesAway=ha}},Oa={name:`light-breeze`,family:`clear`,beaufortLow:2,beaufortHigh:3,cloudiness:.2,precipitation:0,visibilityM:25e3,label:`Light breeze`},ka=8,Aa=.22,ja=850,Ma=343,Na=new a(.82,.88,1),Pa=26e8,Fa=.07,Ia=class{name=`weather`;priority=1;model;warning={approaching:!1,minutesAway:ha};strikePool=[];listeners=new Set;flashLight;random;strikeCount=0;strikeCountdown=4;restrikeCountdown=-1;restrikeIntensity=0;flash=0;forecastCountdown=0;family=`partly-cloudy`;sky;scene;constructor(e){let t=e.settings;this.model=new Da(t.world.seed,t.world.latitudeDeg),this.random=new H((t.world.seed^298732157)>>>0);for(let e=0;e<ka;e+=1)this.strikePool.push({x:0,y:0,z:0,intensity:0,distanceM:0,thunderDelaySeconds:0});this.flashLight=new N(Na,0,0,2),this.flashLight.visible=!1,this.flashLight.castShadow=!1,this.scene=e.scene,this.scene.add(this.flashLight)}get state(){return this.model.state}get descriptor(){return this.model.descriptor}get nextState(){return this.model.neighbour.name}get blend(){return this.model.blend}get barometricTrendHpaPerHour(){return this.model.current.trendHpaPerHour}get stormWarning(){return this.warning}get instability(){return this.model.current.instability}get fogginess(){return this.model.current.fogginess}get lightningFlash(){return this.flash}get lastStrike(){return this.strikeCount===0?void 0:this.strikePool[(this.strikeCount-1)%ka]}get recentStrikes(){return this.strikePool}onLightning(e){return this.listeners.add(e),()=>this.listeners.delete(e)}update(e,t){let n=t.world,r=t.settings,i=t.camera.position;this.model.setLatitude(r.world.latitudeDeg),this.model.setOverride(r.world.weatherOverride);let a=Math.min(30,Math.max(0,t.time.deltaMs/1e3));this.model.step(a,i.x,i.z);let o=this.model.current;n.windX=o.windX,n.windZ=o.windZ,n.windSpeed=o.windSpeed,n.windDirection=o.windDirection,n.cloudiness=o.cloudiness,n.precipitation=o.precipitation,n.visibility=o.visibilityM,n.pressureHpa=o.pressureHpa,n.fetchKm=this.model.fetch;let s=n.ephemeris?.dayFactor??.5;n.temperatureC=o.temperatureC+2.5*(s-.5),this.updateForecast(a,i.x,i.z),this.updateLightning(a,i.x,i.y,i.z);let c=this.model.descriptor.family;c!==this.family&&(this.family=c,this.sky??=t.get(`sky`),this.sky?.setWeather(c))}dispose(){this.scene.remove(this.flashLight),this.flashLight.dispose(),this.listeners.clear()}updateForecast(e,t,n){if(this.forecastCountdown-=e,this.forecastCountdown<=0){this.forecastCountdown=4,this.model.forecast(t,n,this.warning);return}this.warning.approaching&&(this.warning.minutesAway=Math.max(0,this.warning.minutesAway-e/60))}updateLightning(e,t,n,r){this.flash*=Math.exp(-e/.11),this.flash<.001&&(this.flash=0),this.restrikeCountdown>=0&&(this.restrikeCountdown-=e,this.restrikeCountdown<0&&(this.flash=Math.max(this.flash,this.restrikeIntensity)));let i=this.model.current,a=Aa*i.instability*W(.3,.75,i.precipitation);if(a>1e-4&&(this.strikeCountdown-=e*a,this.strikeCountdown<=0&&(this.strikeCountdown=-Math.log(Math.max(1e-6,1-this.random.next())),this.emitStrike(t,n,r))),this.flash>0){let e=this.lastStrike;if(e!==void 0){this.flashLight.position.set(e.x,ja,e.z),this.flashLight.intensity=Pa*this.flash,this.flashLight.visible=!0;return}}this.flashLight.visible=!1}emitStrike(e,t,n){let r=this.strikePool[this.strikeCount%ka];if(this.strikeCount+=1,r===void 0)return;let i=this.random.next()*Math.PI*2,a=350+this.random.next()*this.random.next()*9e3;r.x=e+Math.sin(i)*a,r.y=0,r.z=n+Math.cos(i)*a,r.intensity=.55+.45*this.random.next(),r.distanceM=Math.hypot(r.x-e,t,r.z-n),r.thunderDelaySeconds=r.distanceM/Ma;let o=Math.exp(-3.912/Math.max(500,this.model.current.visibilityM)*a);this.flash=Math.max(this.flash,r.intensity*(.25+.75*o)),this.restrikeIntensity=this.flash*.55,this.restrikeCountdown=Fa;for(let e of this.listeners)e(r)}},La=`varying vec3 vViewRay;
varying vec2 vUv;

uniform mat4 uInverseProjection;
uniform mat4 uCameraWorld;

void main() {
  vUv = uv;

  vec4 clip = vec4(position.xy, 1.0, 1.0);
  vec4 viewSpace = uInverseProjection * clip;
  viewSpace /= viewSpace.w;
  
  
  vViewRay = mat3(uCameraWorld) * viewSpace.xyz;

  gl_Position = clip;
}`,Ra=`precision highp float;

#ifndef ENDLESS_FISHING_CLOUDS\r
#define ENDLESS_FISHING_CLOUDS

#ifndef ENDLESS_FISHING_CONSTANTS\r
#define ENDLESS_FISHING_CONSTANTS

const float PI = 3.14159265358979323846;\r
const float TWO_PI = 6.28318530717958647692;\r
const float HALF_PI = 1.57079632679489661923;\r
const float INV_PI = 0.31830988618379067154;\r
const float INV_FOUR_PI = 0.07957747154594766788;\r
const float DEG_TO_RAD = 0.01745329251994329577;\r
const float RAD_TO_DEG = 57.2957795130823208768;

const float EPS = 1e-6;

#ifndef saturate\r
float saturate(float x) { return clamp(x, 0.0, 1.0); }\r
vec2 saturate(vec2 x) { return clamp(x, 0.0, 1.0); }\r
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }\r
#endif

float ef_luminance(vec3 colour) {\r
  return dot(colour, vec3(0.2126, 0.7152, 0.0722));\r
}

float remap(float x, float lowIn, float highIn, float lowOut, float highOut) {\r
  float span = highIn - lowIn;\r
  float t = span == 0.0 ? step(lowIn, x) : (x - lowIn) / span;\r
  return lowOut + saturate(t) * (highOut - lowOut);\r
}

vec3 hdrClamp(vec3 colour) {\r
  vec3 safe;\r
  safe.x = colour.x == colour.x ? colour.x : 0.0;\r
  safe.y = colour.y == colour.y ? colour.y : 0.0;\r
  safe.z = colour.z == colour.z ? colour.z : 0.0;\r
  
  
  return clamp(safe, vec3(0.0), vec3(60000.0));\r
}

float hdrClampAlpha(float alpha) {\r
  return clamp(alpha == alpha ? alpha : 0.0, 0.0, 1.0);\r
}

#endif

varying vec2 vUv;

const float EARTH_RADIUS_M = 6371000.0;\r
const float EARTH_RADIUS_SQ_M = 40589641000000.0;\r

const float COVER_SPREAD = 0.19;\r

uniform sampler2D uShapeNoise;\r
uniform vec3 uShapeLayout;\r
uniform vec2 uShapeTexel;

uniform sampler2D uDetailNoise;\r
uniform vec3 uDetailLayout;\r
uniform vec2 uDetailTexel;

uniform sampler2D uBlueNoise;\r
uniform vec2 uBlueNoiseTexel;

uniform vec3 uCameraPosition;\r
uniform vec3 uSunDirection;

uniform float uCloudBaseM;\r
uniform float uCloudTopM;

uniform float uInvThickness;

uniform float uCoverage;

uniform float uConvection;

uniform float uAnvil;

uniform float uDensityScale;

uniform vec2 uWindOffset;\r
uniform float uShapeScaleM;\r
uniform float uDetailScaleM;\r
uniform float uErosion;\r

vec4 ef_volume(sampler2D tex, vec3 uvw, vec3 atlas, vec2 texel) {\r
  vec3 w = fract(uvw);\r
  float slices = atlas.z;\r
  float z = w.z * slices;\r
  float z0 = floor(z);\r
  float f = z - z0;\r
  float z1 = mod(z0 + 1.0, slices);

  vec2 tiles = atlas.xy;\r
  vec2 tileSize = 1.0 / tiles;\r
  vec2 inset = texel * tiles * 0.5;\r
  vec2 inner = clamp(w.xy, inset, 1.0 - inset);

  vec2 o0 = vec2(mod(z0, tiles.x), floor(z0 / tiles.x));\r
  vec2 o1 = vec2(mod(z1, tiles.x), floor(z1 / tiles.x));

  vec4 a = texture2DLodEXT(tex, (o0 + inner) * tileSize, 0.0);\r
  vec4 b = texture2DLodEXT(tex, (o1 + inner) * tileSize, 0.0);\r
  return mix(a, b, f);\r
}\r

float ef_safeTransmittance(float t) {\r
  return (t == t) ? clamp(t, 0.0, 1.0) : 1.0;\r
}

float ef_blueNoise(vec2 fragCoord) {\r
  return texture2DLodEXT(uBlueNoise, (fragCoord + 0.5) * uBlueNoiseTexel, 0.0).r;\r
}\r

float ef_altitude(vec3 p) {\r
  float u = 2.0 * EARTH_RADIUS_M * p.y + dot(p, p);\r
  return u / (sqrt(EARTH_RADIUS_SQ_M + u) + EARTH_RADIUS_M);\r
}\r

float ef_shellC(vec3 p, float altitude) {\r
  return dot(p, p) + 2.0 * EARTH_RADIUS_M * (p.y - altitude) - altitude * altitude;\r
}\r

float ef_shellExit(vec3 p, vec3 dir, float altitude) {\r
  float b = dot(vec3(p.x, p.y + EARTH_RADIUS_M, p.z), dir);\r
  float c = ef_shellC(p, altitude);\r
  float discriminant = b * b - c;\r
  if (discriminant < 0.0) return -1.0;\r
  float root = sqrt(discriminant);\r
  float q = -(b + (b >= 0.0 ? root : -root));\r
  if (q == 0.0) return -1.0;\r
  return max(q, c / q);\r
}\r

bool ef_hitsSea(vec3 p, vec3 dir) {\r
  float b = dot(vec3(p.x, p.y + EARTH_RADIUS_M, p.z), dir);\r
  if (b > 0.0) return false;\r
  return b * b - ef_shellC(p, 0.0) >= 0.0;\r
}\r

float ef_heightGradient(float h) {\r
  float stratus = remap(h, 0.0, 0.07, 0.0, 1.0) * remap(h, 0.62, 0.96, 1.0, 0.0);\r
  float cumulus = remap(h, 0.0, 0.26, 0.0, 1.0) * remap(h, 0.52, 1.0, 1.0, 0.0);\r
  float profile = mix(stratus, cumulus, uConvection);

  
  
  
  
  float anvil = smoothstep(0.58, 0.72, h) * (1.0 - smoothstep(0.90, 1.0, h));\r
  return max(profile, uAnvil * anvil);\r
}\r

float ef_cloudDensity(vec3 world, float h, float detailStrength) {\r
  float gradient = ef_heightGradient(h);\r
  if (gradient <= 0.0) return 0.0;

  
  
  vec2 drift = uWindOffset * (0.55 + 0.85 * h);

  vec3 sp = vec3(\r
      (world.x + drift.x) / uShapeScaleM,\r
      world.y / (uShapeScaleM * 0.55),\r
      (world.z + drift.y) / uShapeScaleM);\r
  vec4 shape = ef_volume(uShapeNoise, sp, uShapeLayout, uShapeTexel);

  
  
  
  vec3 regionalUvw = vec3(\r
      (world.x + drift.x * 0.3) / (uShapeScaleM * 8.0),\r
      0.317,\r
      (world.z + drift.y * 0.3) / (uShapeScaleM * 8.0));\r
  float regional = ef_volume(uShapeNoise, regionalUvw, uShapeLayout, uShapeTexel).r;

  float cover = uCoverage * (1.0 + uAnvil * smoothstep(0.58, 0.86, h) * 0.5);

  
  
  
  
  
  
  
  
  
  float spread = mix(-COVER_SPREAD, COVER_SPREAD, regional) * (1.0 - abs(2.0 * cover - 1.0));\r
  cover = saturate(cover + spread);\r
  
  
  
  
  if (cover < 1e-5) return 0.0;

  float worley = shape.g * 0.625 + shape.b * 0.25 + shape.a * 0.125;\r
  float base = remap(shape.r, worley - 1.0, 1.0, 0.0, 1.0);

  
  
  
  
  
  
  
  
  
  
  
  float shapeContrast = 1.0 - smoothstep(0.6, 0.98, cover);\r
  float solid = mix(1.0, base, shapeContrast);\r
  float density = remap(solid * gradient, 1.0 - cover, 1.0, 0.0, 1.0) * cover;\r
  if (density <= 0.0) return 0.0;

  if (detailStrength > 0.0) {\r
    vec3 dp = vec3(\r
        (world.x + drift.x * 1.4) / uDetailScaleM,\r
        world.y / (uDetailScaleM * 0.7),\r
        (world.z + drift.y * 1.4) / uDetailScaleM);\r
    vec3 detail = ef_volume(uDetailNoise, dp, uDetailLayout, uDetailTexel).rgb;\r
    float fine = detail.r * 0.625 + detail.g * 0.25 + detail.b * 0.125;\r
    
    
    float modifier = mix(1.0 - fine, fine, saturate(h * 3.0));\r
    density = remap(density, modifier * uErosion * detailStrength, 1.0, 0.0, 1.0);\r
  }

  return density * uDensityScale;\r
}

#endif

#ifdef CLOUD_MARCH

#ifndef ENDLESS_FISHING_ATMOSPHERE
#define ENDLESS_FISHING_ATMOSPHERE

const float GROUND_RADIUS = 6360.0;
const float ATMOSPHERE_RADIUS = 6460.0;

const vec3 RAYLEIGH_SCATTERING = vec3(5.802, 13.558, 33.100) * 1e-3;
const float RAYLEIGH_SCALE_HEIGHT = 8.0;

const float MIE_SCATTERING = 3.996e-3;
const float MIE_EXTINCTION = 4.400e-3;
const float MIE_SCALE_HEIGHT = 1.2;

const float MIE_ASYMMETRY = 0.8;

const vec3 OZONE_ABSORPTION = vec3(0.650, 1.881, 0.085) * 1e-3;
const float OZONE_CENTRE = 25.0;
const float OZONE_HALF_WIDTH = 15.0;

const vec3 GROUND_ALBEDO = vec3(0.06, 0.07, 0.08);

struct MediumSample {
  vec3 scattering;   
  vec3 extinction;   
  vec3 rayleigh;     
  float mie;         
};

MediumSample sampleMedium(float radius) {
  float altitude = max(0.0, radius - GROUND_RADIUS);

  float rayleighDensity = exp(-altitude / RAYLEIGH_SCALE_HEIGHT);
  float mieDensity = exp(-altitude / MIE_SCALE_HEIGHT);
  float ozoneDensity = max(0.0, 1.0 - abs(altitude - OZONE_CENTRE) / OZONE_HALF_WIDTH);

  MediumSample medium;
  medium.rayleigh = RAYLEIGH_SCATTERING * rayleighDensity;
  medium.mie = MIE_SCATTERING * mieDensity;
  medium.scattering = medium.rayleigh + vec3(medium.mie);
  medium.extinction =
      medium.rayleigh + vec3(MIE_EXTINCTION * mieDensity) + OZONE_ABSORPTION * ozoneDensity;
  return medium;
}

float rayleighPhase(float cosTheta) {
  return 3.0 / (16.0 * PI) * (1.0 + cosTheta * cosTheta);
}

float miePhase(float cosTheta, float g) {
  float g2 = g * g;
  float numerator = 3.0 * (1.0 - g2) * (1.0 + cosTheta * cosTheta);
  float denominator = 8.0 * PI * (2.0 + g2) * pow(max(0.0, 1.0 + g2 - 2.0 * g * cosTheta), 1.5);
  return numerator / denominator;
}

float raySphereIntersect(vec3 origin, vec3 direction, float radius) {
  float b = dot(origin, direction);
  float c = dot(origin, origin) - radius * radius;
  if (c > 0.0 && b > 0.0) return -1.0;
  float discriminant = b * b - c;
  if (discriminant < 0.0) return -1.0;
  float sqrtDiscriminant = sqrt(discriminant);
  float near = -b - sqrtDiscriminant;
  float far = -b + sqrtDiscriminant;
  return near < 0.0 ? far : near;
}

bool intersectsGround(vec3 origin, vec3 direction) {
  return raySphereIntersect(origin, direction, GROUND_RADIUS) > 0.0;
}

vec2 transmittanceUv(float radius, float cosSunZenith) {
  float h = sqrt(max(0.0, ATMOSPHERE_RADIUS * ATMOSPHERE_RADIUS - GROUND_RADIUS * GROUND_RADIUS));
  float rho = sqrt(max(0.0, radius * radius - GROUND_RADIUS * GROUND_RADIUS));

  float discriminant =
      radius * radius * (cosSunZenith * cosSunZenith - 1.0) +
      ATMOSPHERE_RADIUS * ATMOSPHERE_RADIUS;
  float d = max(0.0, -radius * cosSunZenith + sqrt(max(0.0, discriminant)));

  float dMin = ATMOSPHERE_RADIUS - radius;
  float dMax = rho + h;
  return vec2((d - dMin) / max(EPS, dMax - dMin), rho / max(EPS, h));
}

void transmittanceParams(vec2 uv, out float radius, out float cosSunZenith) {
  float h = sqrt(max(0.0, ATMOSPHERE_RADIUS * ATMOSPHERE_RADIUS - GROUND_RADIUS * GROUND_RADIUS));
  float rho = h * uv.y;
  radius = sqrt(rho * rho + GROUND_RADIUS * GROUND_RADIUS);

  float dMin = ATMOSPHERE_RADIUS - radius;
  float dMax = rho + h;
  float d = dMin + uv.x * (dMax - dMin);
  cosSunZenith = d == 0.0
      ? 1.0
      : (h * h - rho * rho - d * d) / (2.0 * radius * d);
  cosSunZenith = clamp(cosSunZenith, -1.0, 1.0);
}

vec3 sampleTransmittance(sampler2D lut, float radius, float cosSunZenith) {
  return texture2DLodEXT(lut, transmittanceUv(radius, cosSunZenith), 0.0).rgb;
}

vec3 computeTransmittance(float radius, float cosSunZenith, int steps) {
  vec3 origin = vec3(0.0, radius, 0.0);
  vec3 direction = vec3(sqrt(max(0.0, 1.0 - cosSunZenith * cosSunZenith)), cosSunZenith, 0.0);

  float distanceToTop = raySphereIntersect(origin, direction, ATMOSPHERE_RADIUS);
  if (distanceToTop < 0.0) return vec3(1.0);

  float stepSize = distanceToTop / float(steps);
  vec3 opticalDepth = vec3(0.0);
  for (int i = 0; i < steps; i++) {
    
    float t = (float(i) + 0.5) * stepSize;
    MediumSample medium = sampleMedium(length(origin + direction * t));
    opticalDepth += medium.extinction * stepSize;
  }
  return exp(-opticalDepth);
}

vec2 skyViewUv(float radius, float cosViewZenith, float azimuth, bool hitsGround) {
  float horizonCos = sqrt(max(0.0, radius * radius - GROUND_RADIUS * GROUND_RADIUS)) / radius;
  float horizonAngle = acos(clamp(horizonCos, -1.0, 1.0));
  float viewZenithAngle = acos(clamp(cosViewZenith, -1.0, 1.0));
  
  float angleFromHorizon = horizonAngle - viewZenithAngle;

  float v;
  if (!hitsGround) {
    float t = sqrt(max(0.0, angleFromHorizon / max(EPS, horizonAngle)));
    v = 0.5 + 0.5 * t;
  } else {
    float t = sqrt(max(0.0, -angleFromHorizon / max(EPS, PI - horizonAngle)));
    v = 0.5 - 0.5 * t;
  }
  return vec2(azimuth / TWO_PI, clamp(v, 0.0, 1.0));
}

void skyViewParams(
    vec2 uv, float radius, out float cosViewZenith, out float azimuth, out bool hitsGround) {
  float horizonCos = sqrt(max(0.0, radius * radius - GROUND_RADIUS * GROUND_RADIUS)) / radius;
  float horizonAngle = acos(clamp(horizonCos, -1.0, 1.0));

  float viewZenithAngle;
  if (uv.y > 0.5) {
    float t = (uv.y - 0.5) * 2.0;
    viewZenithAngle = horizonAngle - t * t * horizonAngle;
    hitsGround = false;
  } else {
    float t = (0.5 - uv.y) * 2.0;
    viewZenithAngle = horizonAngle + t * t * (PI - horizonAngle);
    hitsGround = true;
  }
  cosViewZenith = cos(viewZenithAngle);
  azimuth = uv.x * TWO_PI;
}

#endif

varying vec3 vViewRay;

uniform vec3 uSunColour;

uniform float uSunIrradiance;\r
uniform vec3 uMoonDirection;\r
uniform vec3 uMoonColour;\r
uniform float uMoonIrradiance;

uniform sampler2D uSkyViewLut;\r
uniform float uSkyIntensity;\r
uniform float uAltitudeKm;\r
uniform float uVisibility;\r
uniform float uPhaseG;\r
uniform float uPowder;\r
uniform float uPrecipitation;\r
uniform float uLightningFlash;\r
uniform vec3 uLightningPosition;\r

const float CLOUD_MAX_SPAN_M = 30000.0;

const vec3 LIGHTNING_RADIANCE = vec3(0.86, 0.90, 1.0) * 120000.0;\r

vec3 ef_skyRadiance(vec3 rawDirection) {\r
  float radius = GROUND_RADIUS + max(0.0, uAltitudeKm);\r
  vec3 origin = vec3(0.0, radius, 0.0);\r
  vec3 direction = normalize(vec3(rawDirection.x, max(rawDirection.y, 0.0), rawDirection.z) +\r
                             vec3(EPS, 0.0, 0.0));

  vec2 viewFlat = normalize(vec2(direction.x, direction.z) + vec2(EPS));\r
  vec2 sunFlat = normalize(vec2(uSunDirection.x, uSunDirection.z) + vec2(EPS));\r
  float azimuth = atan(\r
      viewFlat.x * sunFlat.y - viewFlat.y * sunFlat.x,\r
      viewFlat.x * sunFlat.x + viewFlat.y * sunFlat.y);\r
  if (azimuth < 0.0) azimuth += TWO_PI;

  vec2 uv = skyViewUv(radius, direction.y, azimuth, intersectsGround(origin, direction));\r
  return texture2DLodEXT(uSkyViewLut, uv, 0.0).rgb * uSkyIntensity;\r
}

float ef_hg(float cosTheta, float g) {\r
  float g2 = g * g;\r
  return INV_FOUR_PI * (1.0 - g2) / pow(max(1e-4, 1.0 + g2 - 2.0 * g * cosTheta), 1.5);\r
}\r

float ef_phase(float cosTheta, float g) {\r
  return mix(ef_hg(cosTheta, g), ef_hg(cosTheta, -0.28), 0.24);\r
}\r

float ef_lightDepth(vec3 world, vec3 L) {\r
  float stepSize = (uCloudTopM - uCloudBaseM) / float(CLOUD_LIGHT_STEPS) * 0.7;\r
  float tau = 0.0;\r
  float t = stepSize * 0.5;\r
  for (int i = 0; i < CLOUD_LIGHT_STEPS; i++) {\r
    vec3 q = world + L * t;\r
    float h = (q.y - uCloudBaseM) * uInvThickness;\r
    
    
    
    
    
    
    if (h > 0.0 && h < 1.0) {\r
      
      
      float stepDensity = ef_cloudDensity(q, h, 0.0);\r
      if (stepDensity > 0.0) tau += stepDensity * stepSize;\r
    }\r
    t += stepSize;\r
    
    
    stepSize *= 1.55;\r
  }\r
  return tau;\r
}\r

float ef_scatterEnergy(float tau, float cosTheta) {\r
  float energy = 0.0;\r
  float attenuation = 1.0;\r
  float contribution = 1.0;\r
  float eccentricity = 1.0;\r
  for (int o = 0; o < CLOUD_SCATTER_OCTAVES; o++) {\r
    energy += contribution * exp(-tau * attenuation) * ef_phase(cosTheta, uPhaseG * eccentricity);\r
    attenuation *= 0.45;\r
    contribution *= 0.68;\r
    eccentricity *= 0.5;\r
  }\r
  
  
  
  float powder = 1.0 - exp(-tau * 2.2);\r
  return energy * mix(1.0, powder, uPowder);\r
}

void main() {\r
  vec3 dir = normalize(vViewRay);\r
  vec3 origin = vec3(0.0, uCameraPosition.y, 0.0);

  if (ef_hitsSea(origin, dir)) {\r
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);\r
    return;\r
  }

  float tNear = max(0.0, ef_shellExit(origin, dir, uCloudBaseM));\r
  float tFar = min(ef_shellExit(origin, dir, uCloudTopM), tNear + CLOUD_MAX_SPAN_M);\r
  if (tFar <= tNear) {\r
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);\r
    return;\r
  }

  
  
  
  
  
  
  
  
  const float DECK_ALBEDO = 0.7;\r
  vec3 clearAbove = ef_skyRadiance(vec3(0.0, 1.0, 0.0));\r
  vec3 sunlitTops =\r
      uSunColour * uSunIrradiance * INV_PI * DECK_ALBEDO * max(0.0, uSunDirection.y) +\r
      uMoonColour * uMoonIrradiance * INV_PI * DECK_ALBEDO * max(0.0, uMoonDirection.y);\r
  vec3 ambientAbove = mix(clearAbove, max(sunlitTops, clearAbove), uCoverage * uCoverage);

  
  
  
  
  vec3 ambientBelow =\r
      (ef_skyRadiance(vec3(0.0, -1.0, 0.0)) + ambientAbove * 0.07) *\r
      mix(0.85, 0.12, uPrecipitation);

  float cosSun = dot(dir, uSunDirection);\r
  float cosMoon = dot(dir, uMoonDirection);\r
  
  
  
  float sunUp = smoothstep(-0.09, 0.02, uSunDirection.y);\r
  float moonUp = smoothstep(-0.09, 0.02, uMoonDirection.y);\r
  bool sunLit = uSunIrradiance > 1e-3 && sunUp > 0.0;\r
  bool moonLit = uMoonIrradiance > 1e-4 && moonUp > 0.0;

  float stepSize = (tFar - tNear) / float(CLOUD_STEPS);\r
  
  
  
  float t = tNear + stepSize * ef_blueNoise(gl_FragCoord.xy);

  vec3 scatter = vec3(0.0);\r
  float transmittance = 1.0;\r
  float depthSum = 0.0;\r
  float depthWeight = 0.0;

  for (int i = 0; i < CLOUD_STEPS; i++) {\r
    if (transmittance < 0.012) break;

    vec3 local = vec3(dir.x * t, origin.y + dir.y * t, dir.z * t);\r
    float altitude = ef_altitude(local);\r
    float h = (altitude - uCloudBaseM) * uInvThickness;\r
    if (h > 0.0 && h < 1.0) {\r
      vec3 world = vec3(uCameraPosition.x + dir.x * t, altitude, uCameraPosition.z + dir.z * t);\r
      float density = ef_cloudDensity(world, h, 1.0);\r
      if (density > 0.0) {\r
        vec3 light = mix(ambientBelow, ambientAbove, h) * (0.22 + 0.78 * h);\r
        if (sunLit) {\r
          float tau = ef_lightDepth(world, uSunDirection);\r
          light += uSunColour * uSunIrradiance * sunUp * ef_scatterEnergy(tau, cosSun);\r
        }\r
        if (moonLit) {\r
          float tau = ef_lightDepth(world, uMoonDirection);\r
          light += uMoonColour * uMoonIrradiance * moonUp * ef_scatterEnergy(tau, cosMoon);\r
        }\r
        if (uLightningFlash > 0.0) {\r
          light += LIGHTNING_RADIANCE * uLightningFlash *\r
                   exp(-distance(world, uLightningPosition) / 2600.0);\r
        }

        
        
        float segment = exp(-density * stepSize);\r
        float absorbed = 1.0 - segment;\r
        scatter += transmittance * absorbed * light;\r
        depthSum += t * transmittance * absorbed;\r
        depthWeight += transmittance * absorbed;\r
        transmittance *= segment;\r
      }\r
    }\r
    t += stepSize;\r
  }

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  if (depthWeight > 1e-4) {\r
    float meanDistance = depthSum / depthWeight;\r
    float fade = 1.0 - exp(-3.912 / max(200.0, uVisibility) * meanDistance);\r
    vec3 airLight = mix(ef_skyRadiance(dir), ambientBelow, uCoverage * uCoverage);\r
    scatter = mix(scatter, airLight * (1.0 - transmittance), fade);\r
  }

  gl_FragColor = vec4(hdrClamp(scatter), ef_safeTransmittance(transmittance));\r
}

#endif

#ifdef CLOUD_RESOLVE

uniform sampler2D uCloudBuffer;

void main() {\r
  
  
  
  
  vec4 cloud = texture2DLodEXT(uCloudBuffer, vUv, 0.0);\r
  gl_FragColor = vec4(hdrClamp(cloud.rgb), ef_safeTransmittance(cloud.a));\r
}

#endif`,za=`precision highp float;

precision highp float;

#ifndef ENDLESS_FISHING_CLOUDS\r
#define ENDLESS_FISHING_CLOUDS

#ifndef ENDLESS_FISHING_CONSTANTS\r
#define ENDLESS_FISHING_CONSTANTS

const float PI = 3.14159265358979323846;\r
const float TWO_PI = 6.28318530717958647692;\r
const float HALF_PI = 1.57079632679489661923;\r
const float INV_PI = 0.31830988618379067154;\r
const float INV_FOUR_PI = 0.07957747154594766788;\r
const float DEG_TO_RAD = 0.01745329251994329577;\r
const float RAD_TO_DEG = 57.2957795130823208768;

const float EPS = 1e-6;

#ifndef saturate\r
float saturate(float x) { return clamp(x, 0.0, 1.0); }\r
vec2 saturate(vec2 x) { return clamp(x, 0.0, 1.0); }\r
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }\r
#endif

float ef_luminance(vec3 colour) {\r
  return dot(colour, vec3(0.2126, 0.7152, 0.0722));\r
}

float remap(float x, float lowIn, float highIn, float lowOut, float highOut) {\r
  float span = highIn - lowIn;\r
  float t = span == 0.0 ? step(lowIn, x) : (x - lowIn) / span;\r
  return lowOut + saturate(t) * (highOut - lowOut);\r
}

vec3 hdrClamp(vec3 colour) {\r
  vec3 safe;\r
  safe.x = colour.x == colour.x ? colour.x : 0.0;\r
  safe.y = colour.y == colour.y ? colour.y : 0.0;\r
  safe.z = colour.z == colour.z ? colour.z : 0.0;\r
  
  
  return clamp(safe, vec3(0.0), vec3(60000.0));\r
}

float hdrClampAlpha(float alpha) {\r
  return clamp(alpha == alpha ? alpha : 0.0, 0.0, 1.0);\r
}

#endif

varying vec2 vUv;

const float EARTH_RADIUS_M = 6371000.0;\r
const float EARTH_RADIUS_SQ_M = 40589641000000.0;

const float COVER_SPREAD = 0.19;

uniform sampler2D uShapeNoise;\r
uniform vec3 uShapeLayout;\r
uniform vec2 uShapeTexel;

uniform sampler2D uDetailNoise;\r
uniform vec3 uDetailLayout;\r
uniform vec2 uDetailTexel;

uniform sampler2D uBlueNoise;\r
uniform vec2 uBlueNoiseTexel;

uniform vec3 uCameraPosition;\r
uniform vec3 uSunDirection;

uniform float uCloudBaseM;\r
uniform float uCloudTopM;

uniform float uInvThickness;

uniform float uCoverage;

uniform float uConvection;

uniform float uAnvil;

uniform float uDensityScale;

uniform vec2 uWindOffset;\r
uniform float uShapeScaleM;\r
uniform float uDetailScaleM;\r
uniform float uErosion;

vec4 ef_volume(sampler2D tex, vec3 uvw, vec3 atlas, vec2 texel) {\r
  vec3 w = fract(uvw);\r
  float slices = atlas.z;\r
  float z = w.z * slices;\r
  float z0 = floor(z);\r
  float f = z - z0;\r
  float z1 = mod(z0 + 1.0, slices);

  vec2 tiles = atlas.xy;\r
  vec2 tileSize = 1.0 / tiles;\r
  vec2 inset = texel * tiles * 0.5;\r
  vec2 inner = clamp(w.xy, inset, 1.0 - inset);

  vec2 o0 = vec2(mod(z0, tiles.x), floor(z0 / tiles.x));\r
  vec2 o1 = vec2(mod(z1, tiles.x), floor(z1 / tiles.x));

  vec4 a = texture2DLodEXT(tex, (o0 + inner) * tileSize, 0.0);\r
  vec4 b = texture2DLodEXT(tex, (o1 + inner) * tileSize, 0.0);\r
  return mix(a, b, f);\r
}

float ef_safeTransmittance(float t) {\r
  return (t == t) ? clamp(t, 0.0, 1.0) : 1.0;\r
}

float ef_blueNoise(vec2 fragCoord) {\r
  return texture2DLodEXT(uBlueNoise, (fragCoord + 0.5) * uBlueNoiseTexel, 0.0).r;\r
}

float ef_altitude(vec3 p) {\r
  float u = 2.0 * EARTH_RADIUS_M * p.y + dot(p, p);\r
  return u / (sqrt(EARTH_RADIUS_SQ_M + u) + EARTH_RADIUS_M);\r
}

float ef_shellC(vec3 p, float altitude) {\r
  return dot(p, p) + 2.0 * EARTH_RADIUS_M * (p.y - altitude) - altitude * altitude;\r
}

float ef_shellExit(vec3 p, vec3 dir, float altitude) {\r
  float b = dot(vec3(p.x, p.y + EARTH_RADIUS_M, p.z), dir);\r
  float c = ef_shellC(p, altitude);\r
  float discriminant = b * b - c;\r
  if (discriminant < 0.0) return -1.0;\r
  float root = sqrt(discriminant);\r
  float q = -(b + (b >= 0.0 ? root : -root));\r
  if (q == 0.0) return -1.0;\r
  return max(q, c / q);\r
}

bool ef_hitsSea(vec3 p, vec3 dir) {\r
  float b = dot(vec3(p.x, p.y + EARTH_RADIUS_M, p.z), dir);\r
  if (b > 0.0) return false;\r
  return b * b - ef_shellC(p, 0.0) >= 0.0;\r
}

float ef_heightGradient(float h) {\r
  float stratus = remap(h, 0.0, 0.07, 0.0, 1.0) * remap(h, 0.62, 0.96, 1.0, 0.0);\r
  float cumulus = remap(h, 0.0, 0.26, 0.0, 1.0) * remap(h, 0.52, 1.0, 1.0, 0.0);\r
  float profile = mix(stratus, cumulus, uConvection);

  
  
  
  
  float anvil = smoothstep(0.58, 0.72, h) * (1.0 - smoothstep(0.90, 1.0, h));\r
  return max(profile, uAnvil * anvil);\r
}

float ef_cloudDensity(vec3 world, float h, float detailStrength) {\r
  float gradient = ef_heightGradient(h);\r
  if (gradient <= 0.0) return 0.0;

  
  
  vec2 drift = uWindOffset * (0.55 + 0.85 * h);

  vec3 sp = vec3(\r
      (world.x + drift.x) / uShapeScaleM,\r
      world.y / (uShapeScaleM * 0.55),\r
      (world.z + drift.y) / uShapeScaleM);\r
  vec4 shape = ef_volume(uShapeNoise, sp, uShapeLayout, uShapeTexel);

  
  
  
  vec3 regionalUvw = vec3(\r
      (world.x + drift.x * 0.3) / (uShapeScaleM * 8.0),\r
      0.317,\r
      (world.z + drift.y * 0.3) / (uShapeScaleM * 8.0));\r
  float regional = ef_volume(uShapeNoise, regionalUvw, uShapeLayout, uShapeTexel).r;

  float cover = uCoverage * (1.0 + uAnvil * smoothstep(0.58, 0.86, h) * 0.5);

  
  
  
  
  
  
  
  
  
  float spread = mix(-COVER_SPREAD, COVER_SPREAD, regional) * (1.0 - abs(2.0 * cover - 1.0));\r
  cover = saturate(cover + spread);\r
  
  
  
  
  if (cover < 1e-5) return 0.0;

  float worley = shape.g * 0.625 + shape.b * 0.25 + shape.a * 0.125;\r
  float base = remap(shape.r, worley - 1.0, 1.0, 0.0, 1.0);

  
  
  
  
  
  
  
  
  
  
  
  float shapeContrast = 1.0 - smoothstep(0.6, 0.98, cover);\r
  float solid = mix(1.0, base, shapeContrast);\r
  float density = remap(solid * gradient, 1.0 - cover, 1.0, 0.0, 1.0) * cover;\r
  if (density <= 0.0) return 0.0;

  if (detailStrength > 0.0) {\r
    vec3 dp = vec3(\r
        (world.x + drift.x * 1.4) / uDetailScaleM,\r
        world.y / (uDetailScaleM * 0.7),\r
        (world.z + drift.y * 1.4) / uDetailScaleM);\r
    vec3 detail = ef_volume(uDetailNoise, dp, uDetailLayout, uDetailTexel).rgb;\r
    float fine = detail.r * 0.625 + detail.g * 0.25 + detail.b * 0.125;\r
    
    
    float modifier = mix(1.0 - fine, fine, saturate(h * 3.0));\r
    density = remap(density, modifier * uErosion * detailStrength, 1.0, 0.0, 1.0);\r
  }

  return density * uDensityScale;\r
}

#endif

#ifdef CLOUD_MARCH

#ifndef ENDLESS_FISHING_ATMOSPHERE
#define ENDLESS_FISHING_ATMOSPHERE

const float GROUND_RADIUS = 6360.0;
const float ATMOSPHERE_RADIUS = 6460.0;

const vec3 RAYLEIGH_SCATTERING = vec3(5.802, 13.558, 33.100) * 1e-3;
const float RAYLEIGH_SCALE_HEIGHT = 8.0;

const float MIE_SCATTERING = 3.996e-3;
const float MIE_EXTINCTION = 4.400e-3;
const float MIE_SCALE_HEIGHT = 1.2;

const float MIE_ASYMMETRY = 0.8;

const vec3 OZONE_ABSORPTION = vec3(0.650, 1.881, 0.085) * 1e-3;
const float OZONE_CENTRE = 25.0;
const float OZONE_HALF_WIDTH = 15.0;

const vec3 GROUND_ALBEDO = vec3(0.06, 0.07, 0.08);

struct MediumSample {
  vec3 scattering;   
  vec3 extinction;   
  vec3 rayleigh;     
  float mie;         
};

MediumSample sampleMedium(float radius) {
  float altitude = max(0.0, radius - GROUND_RADIUS);

  float rayleighDensity = exp(-altitude / RAYLEIGH_SCALE_HEIGHT);
  float mieDensity = exp(-altitude / MIE_SCALE_HEIGHT);
  float ozoneDensity = max(0.0, 1.0 - abs(altitude - OZONE_CENTRE) / OZONE_HALF_WIDTH);

  MediumSample medium;
  medium.rayleigh = RAYLEIGH_SCATTERING * rayleighDensity;
  medium.mie = MIE_SCATTERING * mieDensity;
  medium.scattering = medium.rayleigh + vec3(medium.mie);
  medium.extinction =
      medium.rayleigh + vec3(MIE_EXTINCTION * mieDensity) + OZONE_ABSORPTION * ozoneDensity;
  return medium;
}

float rayleighPhase(float cosTheta) {
  return 3.0 / (16.0 * PI) * (1.0 + cosTheta * cosTheta);
}

float miePhase(float cosTheta, float g) {
  float g2 = g * g;
  float numerator = 3.0 * (1.0 - g2) * (1.0 + cosTheta * cosTheta);
  float denominator = 8.0 * PI * (2.0 + g2) * pow(max(0.0, 1.0 + g2 - 2.0 * g * cosTheta), 1.5);
  return numerator / denominator;
}

float raySphereIntersect(vec3 origin, vec3 direction, float radius) {
  float b = dot(origin, direction);
  float c = dot(origin, origin) - radius * radius;
  if (c > 0.0 && b > 0.0) return -1.0;
  float discriminant = b * b - c;
  if (discriminant < 0.0) return -1.0;
  float sqrtDiscriminant = sqrt(discriminant);
  float near = -b - sqrtDiscriminant;
  float far = -b + sqrtDiscriminant;
  return near < 0.0 ? far : near;
}

bool intersectsGround(vec3 origin, vec3 direction) {
  return raySphereIntersect(origin, direction, GROUND_RADIUS) > 0.0;
}

vec2 transmittanceUv(float radius, float cosSunZenith) {
  float h = sqrt(max(0.0, ATMOSPHERE_RADIUS * ATMOSPHERE_RADIUS - GROUND_RADIUS * GROUND_RADIUS));
  float rho = sqrt(max(0.0, radius * radius - GROUND_RADIUS * GROUND_RADIUS));

  float discriminant =
      radius * radius * (cosSunZenith * cosSunZenith - 1.0) +
      ATMOSPHERE_RADIUS * ATMOSPHERE_RADIUS;
  float d = max(0.0, -radius * cosSunZenith + sqrt(max(0.0, discriminant)));

  float dMin = ATMOSPHERE_RADIUS - radius;
  float dMax = rho + h;
  return vec2((d - dMin) / max(EPS, dMax - dMin), rho / max(EPS, h));
}

void transmittanceParams(vec2 uv, out float radius, out float cosSunZenith) {
  float h = sqrt(max(0.0, ATMOSPHERE_RADIUS * ATMOSPHERE_RADIUS - GROUND_RADIUS * GROUND_RADIUS));
  float rho = h * uv.y;
  radius = sqrt(rho * rho + GROUND_RADIUS * GROUND_RADIUS);

  float dMin = ATMOSPHERE_RADIUS - radius;
  float dMax = rho + h;
  float d = dMin + uv.x * (dMax - dMin);
  cosSunZenith = d == 0.0
      ? 1.0
      : (h * h - rho * rho - d * d) / (2.0 * radius * d);
  cosSunZenith = clamp(cosSunZenith, -1.0, 1.0);
}

vec3 sampleTransmittance(sampler2D lut, float radius, float cosSunZenith) {
  return texture2DLodEXT(lut, transmittanceUv(radius, cosSunZenith), 0.0).rgb;
}

vec3 computeTransmittance(float radius, float cosSunZenith, int steps) {
  vec3 origin = vec3(0.0, radius, 0.0);
  vec3 direction = vec3(sqrt(max(0.0, 1.0 - cosSunZenith * cosSunZenith)), cosSunZenith, 0.0);

  float distanceToTop = raySphereIntersect(origin, direction, ATMOSPHERE_RADIUS);
  if (distanceToTop < 0.0) return vec3(1.0);

  float stepSize = distanceToTop / float(steps);
  vec3 opticalDepth = vec3(0.0);
  for (int i = 0; i < steps; i++) {
    
    float t = (float(i) + 0.5) * stepSize;
    MediumSample medium = sampleMedium(length(origin + direction * t));
    opticalDepth += medium.extinction * stepSize;
  }
  return exp(-opticalDepth);
}

vec2 skyViewUv(float radius, float cosViewZenith, float azimuth, bool hitsGround) {
  float horizonCos = sqrt(max(0.0, radius * radius - GROUND_RADIUS * GROUND_RADIUS)) / radius;
  float horizonAngle = acos(clamp(horizonCos, -1.0, 1.0));
  float viewZenithAngle = acos(clamp(cosViewZenith, -1.0, 1.0));
  
  float angleFromHorizon = horizonAngle - viewZenithAngle;

  float v;
  if (!hitsGround) {
    float t = sqrt(max(0.0, angleFromHorizon / max(EPS, horizonAngle)));
    v = 0.5 + 0.5 * t;
  } else {
    float t = sqrt(max(0.0, -angleFromHorizon / max(EPS, PI - horizonAngle)));
    v = 0.5 - 0.5 * t;
  }
  return vec2(azimuth / TWO_PI, clamp(v, 0.0, 1.0));
}

void skyViewParams(
    vec2 uv, float radius, out float cosViewZenith, out float azimuth, out bool hitsGround) {
  float horizonCos = sqrt(max(0.0, radius * radius - GROUND_RADIUS * GROUND_RADIUS)) / radius;
  float horizonAngle = acos(clamp(horizonCos, -1.0, 1.0));

  float viewZenithAngle;
  if (uv.y > 0.5) {
    float t = (uv.y - 0.5) * 2.0;
    viewZenithAngle = horizonAngle - t * t * horizonAngle;
    hitsGround = false;
  } else {
    float t = (0.5 - uv.y) * 2.0;
    viewZenithAngle = horizonAngle + t * t * (PI - horizonAngle);
    hitsGround = true;
  }
  cosViewZenith = cos(viewZenithAngle);
  azimuth = uv.x * TWO_PI;
}

#endif

varying vec3 vViewRay;

uniform vec3 uSunColour;

uniform float uSunIrradiance;\r
uniform vec3 uMoonDirection;\r
uniform vec3 uMoonColour;\r
uniform float uMoonIrradiance;

uniform sampler2D uSkyViewLut;\r
uniform float uSkyIntensity;\r
uniform float uAltitudeKm;\r
uniform float uVisibility;\r
uniform float uPhaseG;\r
uniform float uPowder;\r
uniform float uPrecipitation;\r
uniform float uLightningFlash;\r
uniform vec3 uLightningPosition;

const float CLOUD_MAX_SPAN_M = 30000.0;

const vec3 LIGHTNING_RADIANCE = vec3(0.86, 0.90, 1.0) * 120000.0;

vec3 ef_skyRadiance(vec3 rawDirection) {\r
  float radius = GROUND_RADIUS + max(0.0, uAltitudeKm);\r
  vec3 origin = vec3(0.0, radius, 0.0);\r
  vec3 direction = normalize(vec3(rawDirection.x, max(rawDirection.y, 0.0), rawDirection.z) +\r
                             vec3(EPS, 0.0, 0.0));

  vec2 viewFlat = normalize(vec2(direction.x, direction.z) + vec2(EPS));\r
  vec2 sunFlat = normalize(vec2(uSunDirection.x, uSunDirection.z) + vec2(EPS));\r
  float azimuth = atan(\r
      viewFlat.x * sunFlat.y - viewFlat.y * sunFlat.x,\r
      viewFlat.x * sunFlat.x + viewFlat.y * sunFlat.y);\r
  if (azimuth < 0.0) azimuth += TWO_PI;

  vec2 uv = skyViewUv(radius, direction.y, azimuth, intersectsGround(origin, direction));\r
  return texture2DLodEXT(uSkyViewLut, uv, 0.0).rgb * uSkyIntensity;\r
}

float ef_hg(float cosTheta, float g) {\r
  float g2 = g * g;\r
  return INV_FOUR_PI * (1.0 - g2) / pow(max(1e-4, 1.0 + g2 - 2.0 * g * cosTheta), 1.5);\r
}

float ef_phase(float cosTheta, float g) {\r
  return mix(ef_hg(cosTheta, g), ef_hg(cosTheta, -0.28), 0.24);\r
}

float ef_lightDepth(vec3 world, vec3 L) {\r
  float stepSize = (uCloudTopM - uCloudBaseM) / float(CLOUD_LIGHT_STEPS) * 0.7;\r
  float tau = 0.0;\r
  float t = stepSize * 0.5;\r
  for (int i = 0; i < CLOUD_LIGHT_STEPS; i++) {\r
    vec3 q = world + L * t;\r
    float h = (q.y - uCloudBaseM) * uInvThickness;\r
    
    
    
    
    
    
    if (h > 0.0 && h < 1.0) {\r
      
      
      float stepDensity = ef_cloudDensity(q, h, 0.0);\r
      if (stepDensity > 0.0) tau += stepDensity * stepSize;\r
    }\r
    t += stepSize;\r
    
    
    stepSize *= 1.55;\r
  }\r
  return tau;\r
}

float ef_scatterEnergy(float tau, float cosTheta) {\r
  float energy = 0.0;\r
  float attenuation = 1.0;\r
  float contribution = 1.0;\r
  float eccentricity = 1.0;\r
  for (int o = 0; o < CLOUD_SCATTER_OCTAVES; o++) {\r
    energy += contribution * exp(-tau * attenuation) * ef_phase(cosTheta, uPhaseG * eccentricity);\r
    attenuation *= 0.45;\r
    contribution *= 0.68;\r
    eccentricity *= 0.5;\r
  }\r
  
  
  
  float powder = 1.0 - exp(-tau * 2.2);\r
  return energy * mix(1.0, powder, uPowder);\r
}

void main() {\r
  vec3 dir = normalize(vViewRay);\r
  vec3 origin = vec3(0.0, uCameraPosition.y, 0.0);

  if (ef_hitsSea(origin, dir)) {\r
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);\r
    return;\r
  }

  float tNear = max(0.0, ef_shellExit(origin, dir, uCloudBaseM));\r
  float tFar = min(ef_shellExit(origin, dir, uCloudTopM), tNear + CLOUD_MAX_SPAN_M);\r
  if (tFar <= tNear) {\r
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);\r
    return;\r
  }

  
  
  
  
  
  
  
  
  const float DECK_ALBEDO = 0.7;\r
  vec3 clearAbove = ef_skyRadiance(vec3(0.0, 1.0, 0.0));\r
  vec3 sunlitTops =\r
      uSunColour * uSunIrradiance * INV_PI * DECK_ALBEDO * max(0.0, uSunDirection.y) +\r
      uMoonColour * uMoonIrradiance * INV_PI * DECK_ALBEDO * max(0.0, uMoonDirection.y);\r
  vec3 ambientAbove = mix(clearAbove, max(sunlitTops, clearAbove), uCoverage * uCoverage);

  
  
  
  
  vec3 ambientBelow =\r
      (ef_skyRadiance(vec3(0.0, -1.0, 0.0)) + ambientAbove * 0.07) *\r
      mix(0.85, 0.12, uPrecipitation);

  float cosSun = dot(dir, uSunDirection);\r
  float cosMoon = dot(dir, uMoonDirection);\r
  
  
  
  float sunUp = smoothstep(-0.09, 0.02, uSunDirection.y);\r
  float moonUp = smoothstep(-0.09, 0.02, uMoonDirection.y);\r
  bool sunLit = uSunIrradiance > 1e-3 && sunUp > 0.0;\r
  bool moonLit = uMoonIrradiance > 1e-4 && moonUp > 0.0;

  float stepSize = (tFar - tNear) / float(CLOUD_STEPS);\r
  
  
  
  float t = tNear + stepSize * ef_blueNoise(gl_FragCoord.xy);

  vec3 scatter = vec3(0.0);\r
  float transmittance = 1.0;\r
  float depthSum = 0.0;\r
  float depthWeight = 0.0;

  for (int i = 0; i < CLOUD_STEPS; i++) {\r
    if (transmittance < 0.012) break;

    vec3 local = vec3(dir.x * t, origin.y + dir.y * t, dir.z * t);\r
    float altitude = ef_altitude(local);\r
    float h = (altitude - uCloudBaseM) * uInvThickness;\r
    if (h > 0.0 && h < 1.0) {\r
      vec3 world = vec3(uCameraPosition.x + dir.x * t, altitude, uCameraPosition.z + dir.z * t);\r
      float density = ef_cloudDensity(world, h, 1.0);\r
      if (density > 0.0) {\r
        vec3 light = mix(ambientBelow, ambientAbove, h) * (0.22 + 0.78 * h);\r
        if (sunLit) {\r
          float tau = ef_lightDepth(world, uSunDirection);\r
          light += uSunColour * uSunIrradiance * sunUp * ef_scatterEnergy(tau, cosSun);\r
        }\r
        if (moonLit) {\r
          float tau = ef_lightDepth(world, uMoonDirection);\r
          light += uMoonColour * uMoonIrradiance * moonUp * ef_scatterEnergy(tau, cosMoon);\r
        }\r
        if (uLightningFlash > 0.0) {\r
          light += LIGHTNING_RADIANCE * uLightningFlash *\r
                   exp(-distance(world, uLightningPosition) / 2600.0);\r
        }

        
        
        float segment = exp(-density * stepSize);\r
        float absorbed = 1.0 - segment;\r
        scatter += transmittance * absorbed * light;\r
        depthSum += t * transmittance * absorbed;\r
        depthWeight += transmittance * absorbed;\r
        transmittance *= segment;\r
      }\r
    }\r
    t += stepSize;\r
  }

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  if (depthWeight > 1e-4) {\r
    float meanDistance = depthSum / depthWeight;\r
    float fade = 1.0 - exp(-3.912 / max(200.0, uVisibility) * meanDistance);\r
    vec3 airLight = mix(ef_skyRadiance(dir), ambientBelow, uCoverage * uCoverage);\r
    scatter = mix(scatter, airLight * (1.0 - transmittance), fade);\r
  }

  gl_FragColor = vec4(hdrClamp(scatter), ef_safeTransmittance(transmittance));\r
}

#endif

#ifdef CLOUD_RESOLVE

uniform sampler2D uCloudBuffer;

void main() {\r
  
  
  
  
  vec4 cloud = texture2DLodEXT(uCloudBuffer, vUv, 0.0);\r
  gl_FragColor = vec4(hdrClamp(cloud.rgb), ef_safeTransmittance(cloud.a));\r
}

#endif

uniform vec2 uShadowCentre;

uniform float uShadowExtent;

uniform float uShadowStrength;

void main() {
  vec3 L = uSunDirection;
  
  
  if (L.y < 0.04 || uShadowStrength <= 0.0) {
    gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
    return;
  }

  vec2 ground = uShadowCentre + (vUv * 2.0 - 1.0) * uShadowExtent;

  float entry = uCloudBaseM / L.y;
  float exit = uCloudTopM / L.y;
  float dt = (exit - entry) / float(CLOUD_SHADOW_STEPS);
  
  
  float t = entry + dt * ef_blueNoise(gl_FragCoord.xy);

  float tau = 0.0;
  for (int i = 0; i < CLOUD_SHADOW_STEPS; i++) {
    vec3 q = vec3(ground.x + L.x * t, L.y * t, ground.y + L.z * t);
    
    
    
    tau += ef_cloudDensity(q, (q.y - uCloudBaseM) * uInvThickness, 0.0) * dt;
    t += dt;
  }

  
  gl_FragColor = vec4(mix(1.0, exp(-tau), uShadowStrength), 0.0, 0.0, 1.0);
}`,Ba=64,Va=8,Ha=8,Ua=32,Wa=8,Ga=4,Ka=64,qa=2200,Ja=1.6,Ya=new a(1,.62,.36),Xa=new a(1,.96,.92),Za=new a(.72,.8,1),Qa={baseM:950,topM:2350,convection:.78,anvil:0,density:.055,erosion:.28,shapeScaleM:4200},$a={baseM:380,topM:1050,convection:.04,anvil:0,density:.042,erosion:.1,shapeScaleM:7200},eo={baseM:720,topM:8600,convection:1,anvil:1,density:.085,erosion:.2,shapeScaleM:5400},to=class{name=`clouds`;priority=2;geometry;uniforms;marchMaterial;probeMaterial;resolveMaterial;shadowMaterial;resolveMesh;probeMesh;pass=new Nt;cloudTarget;shadowTarget;shadowValid=!1;shapeNoise;detailNoise;blueNoise;shadowMatrixValue=new b;scratchSun=new a;scene;profile={...Qa};cloudScale;shadowResolution;weather;sky;constructor(n){let r=n.settings.graphics,i=n.settings.world.seed;this.cloudScale=r.cloudScale,this.shadowResolution=co(r.cloudScale),this.shapeNoise=n.resources.track(bo(i^1544555866)),this.detailNoise=n.resources.track(So(i^242880770)),this.blueNoise=n.resources.track(Co(Ka,(i^454950912)>>>0)),this.cloudTarget=lo(1,1),this.shadowTarget=uo(this.shadowResolution),this.uniforms={uInverseProjection:{value:new b},uCameraWorld:{value:new b},uCameraPosition:{value:new t},uShapeNoise:{value:this.shapeNoise},uShapeLayout:{value:new t(Va,Ha,Ba)},uShapeTexel:{value:new x(1/512,1/512)},uDetailNoise:{value:this.detailNoise},uDetailLayout:{value:new t(Wa,Ga,Ua)},uDetailTexel:{value:new x(1/256,1/128)},uBlueNoise:{value:this.blueNoise},uBlueNoiseTexel:{value:new x(1/Ka,1/Ka)},uCloudBaseM:{value:Qa.baseM},uCloudTopM:{value:Qa.topM},uInvThickness:{value:1/(Qa.topM-Qa.baseM)},uCoverage:{value:.3},uConvection:{value:Qa.convection},uAnvil:{value:0},uDensityScale:{value:Qa.density},uWindOffset:{value:new x},uShapeScaleM:{value:Qa.shapeScaleM},uDetailScaleM:{value:520},uErosion:{value:Qa.erosion},uSunDirection:{value:new t(0,1,0)},uSunColour:{value:new a(1,1,1)},uSunIrradiance:{value:0},uMoonDirection:{value:new t(0,-1,0)},uMoonColour:{value:Za.clone()},uMoonIrradiance:{value:0},uSkyViewLut:{value:null},uSkyIntensity:{value:1},uAltitudeKm:{value:.0022},uVisibility:{value:25e3},uPhaseG:{value:.62},uPowder:{value:.6},uPrecipitation:{value:0},uLightningFlash:{value:0},uLightningPosition:{value:new t},uCloudBuffer:{value:this.cloudTarget.texture},uShadowCentre:{value:new x},uShadowExtent:{value:qa},uShadowStrength:{value:0}},this.marchMaterial=this.createMaterial(Ra,{CLOUD_MARCH:``,CLOUD_STEPS:String(io(r.cloudSteps)),CLOUD_LIGHT_STEPS:String(ao(r.cloudSteps)),CLOUD_SCATTER_OCTAVES:`3`}),this.probeMaterial=this.createMaterial(Ra,{CLOUD_MARCH:``,CLOUD_STEPS:String(oo(r.cloudSteps)),CLOUD_LIGHT_STEPS:`3`,CLOUD_SCATTER_OCTAVES:`2`}),this.resolveMaterial=this.createMaterial(Ra,{CLOUD_RESOLVE:``}),this.shadowMaterial=this.createMaterial(za,{CLOUD_SHADOW_STEPS:String(so(r.cloudSteps))});for(let e of[this.resolveMaterial,this.probeMaterial])e.blending=5,e.blendSrc=201,e.blendDst=204,e.blendSrcAlpha=200,e.blendDstAlpha=204;this.geometry=fo(),this.resolveMesh=new e(this.geometry,this.resolveMaterial),this.resolveMesh.frustumCulled=!1,this.resolveMesh.renderOrder=-999,this.probeMesh=new e(this.geometry,this.probeMaterial),this.probeMesh.frustumCulled=!1,this.probeMesh.renderOrder=-999,this.probeMesh.layers.set(1),this.probeMesh.onBeforeRender=(e,t,n)=>{this.pushCamera(n)},this.scene=n.scene,this.scene.add(this.resolveMesh,this.probeMesh)}get shadowTexture(){return this.shadowValid?this.shadowTarget.texture:null}get shadowMatrix(){return this.shadowMatrixValue}diagnostics(e){let t=this.cloudTarget.width,n=this.cloudTarget.height,r=new Uint16Array(t*n*4);e.readRenderTargetPixels(this.cloudTarget,0,0,t,n,r);let i=0,a=0,s=t*n;for(let e=0;e<s;e+=1)i+=o.fromHalfFloat(r[e*4]??0),a+=o.fromHalfFloat(r[e*4+3]??0);let c=this.uniforms.uCoverage?.value;return{coverage:typeof c==`number`?c:-1,baseM:this.profile.baseM,topM:this.profile.topM,density:this.profile.density,convection:this.profile.convection,anvil:this.profile.anvil,meanTransmittance:s===0?-1:a/s,meanScatter:s===0?-1:i/s}}update(e,t){let n=t.world,r=this.uniforms;this.weather??=t.get(`weather`),this.sky??=t.get(`sky`);let i=Math.min(e,.1)*Ja,a=r.uWindOffset?.value;a instanceof x&&(a.x-=n.windX*i,a.y-=n.windZ*i),this.updateProfile(e,n.cloudiness,this.weather?.instability??0),q(r,`uCoverage`,n.cloudiness),q(r,`uVisibility`,n.visibility),q(r,`uPrecipitation`,n.precipitation),q(r,`uCloudBaseM`,this.profile.baseM),q(r,`uCloudTopM`,this.profile.topM),q(r,`uInvThickness`,1/Math.max(50,this.profile.topM-this.profile.baseM)),q(r,`uConvection`,this.profile.convection),q(r,`uAnvil`,this.profile.anvil),q(r,`uDensityScale`,this.profile.density),q(r,`uErosion`,this.profile.erosion),q(r,`uShapeScaleM`,this.profile.shapeScaleM),this.updateLighting(t),this.updateLightning()}beforeRender(e){let t=Math.max(2,Math.round(e.width*e.pixelRatio*this.cloudScale)),n=Math.max(2,Math.round(e.height*e.pixelRatio*this.cloudScale));(this.cloudTarget.width!==t||this.cloudTarget.height!==n)&&this.cloudTarget.setSize(t,n),this.pushCamera(e.camera),this.pass.render(e.renderer,this.marchMaterial,this.cloudTarget),this.renderShadowMask(e)}onSettingsChanged(e){let t=e.settings.graphics;this.cloudScale=t.cloudScale,ro(this.marchMaterial,`CLOUD_STEPS`,io(t.cloudSteps)),ro(this.marchMaterial,`CLOUD_LIGHT_STEPS`,ao(t.cloudSteps)),ro(this.probeMaterial,`CLOUD_STEPS`,oo(t.cloudSteps)),ro(this.shadowMaterial,`CLOUD_SHADOW_STEPS`,so(t.cloudSteps));let n=co(t.cloudScale);n!==this.shadowResolution&&(this.shadowResolution=n,this.shadowTarget.setSize(n,n),this.shadowValid=!1)}dispose(){this.scene.remove(this.resolveMesh,this.probeMesh),this.geometry.dispose(),this.marchMaterial.dispose(),this.probeMaterial.dispose(),this.resolveMaterial.dispose(),this.shadowMaterial.dispose(),this.cloudTarget.dispose(),this.shadowTarget.dispose(),this.pass.dispose()}createMaterial(e,t){return new i({vertexShader:La,fragmentShader:e,uniforms:this.uniforms,defines:t,depthTest:!1,depthWrite:!1,transparent:!1,side:2})}pushCamera(e){let n=this.uniforms.uInverseProjection?.value;n instanceof b&&n.copy(e.projectionMatrix).invert();let r=this.uniforms.uCameraWorld?.value;r instanceof b&&r.copy(e.matrixWorld);let i=this.uniforms.uCameraPosition?.value;i instanceof t&&i.setFromMatrixPosition(e.matrixWorld)}updateProfile(e,t,n){let r=W(.45,.8,n),i=(1-r)*W(.55,.92,t)*(1-W(.15,.45,n)),a=Math.max(0,1-r-i),o=.06,s=Math.min(e,.1);this.profile.baseM=K(this.profile.baseM,no(a,i,r,`baseM`),o,s),this.profile.topM=K(this.profile.topM,no(a,i,r,`topM`),o,s),this.profile.convection=K(this.profile.convection,no(a,i,r,`convection`),o,s),this.profile.anvil=K(this.profile.anvil,no(a,i,r,`anvil`),o,s),this.profile.density=K(this.profile.density,no(a,i,r,`density`),o,s),this.profile.erosion=K(this.profile.erosion,no(a,i,r,`erosion`),o,s),this.profile.shapeScaleM=K(this.profile.shapeScaleM,no(a,i,r,`shapeScaleM`),o,s)}updateLighting(e){let n=this.uniforms,r=e.world.ephemeris,i=this.sky;if(i!==void 0){let e=n.uSkyViewLut;e!==void 0&&(e.value=i.atmosphere.skyViewLut),q(n,`uSkyIntensity`,i.skyIntensity)}if(r===null)return;let o=n.uSunDirection?.value;o instanceof t&&o.set(r.sunDirectionRefracted.x,r.sunDirectionRefracted.y,r.sunDirectionRefracted.z);let s=n.uMoonDirection?.value;s instanceof t&&s.set(r.moonDirection.x,r.moonDirection.y,r.moonDirection.z);let c=1-W(0,18,r.sunAltitudeDeg);this.scratchSun.copy(Xa).lerp(Ya,c*c);let l=n.uSunColour?.value;l instanceof a&&l.copy(this.scratchSun),q(n,`uSunIrradiance`,r.sunIlluminanceLux),q(n,`uMoonIrradiance`,r.moonIlluminanceLux)}updateLightning(){let e=this.weather,n=e?.lightningFlash??0;q(this.uniforms,`uLightningFlash`,n);let r=e?.lastStrike,i=this.uniforms.uLightningPosition?.value;n>0&&r!==void 0&&i instanceof t&&i.set(r.x,this.profile.baseM+200,r.z)}renderShadowMask(e){let n=this.uniforms,r=n.uSunDirection?.value;q(n,`uShadowStrength`,W(.02,.1,r instanceof t?r.y:0)*W(.02,.16,e.world.cloudiness));let i=qa*2/this.shadowResolution,a=Math.round(e.camera.position.x/i)*i,o=Math.round(e.camera.position.z/i)*i,s=n.uShadowCentre?.value;s instanceof x&&s.set(a,o);let c=qa*2;this.shadowMatrixValue.set(1/c,0,0,.5-a/c,0,0,1/c,.5-o/c,0,0,0,0,0,0,0,1),this.pass.render(e.renderer,this.shadowMaterial,this.shadowTarget),this.shadowValid=!0}};function no(e,t,n,r){return Qa[r]*e+$a[r]*t+eo[r]*n}function q(e,t,n){let r=e[t];r!==void 0&&(r.value=n)}function ro(e,t,n){let r=e.defines;if(r===void 0)return;let i=String(n);r[t]!==i&&(r[t]=i,e.needsUpdate=!0)}function io(e){return Math.max(8,Math.min(96,Math.round(e)))}function ao(e){return e>=40?6:e>=24?5:4}function oo(e){return Math.max(8,Math.round(e/3))}function so(e){return e>=40?16:e>=24?12:8}function co(e){return Math.max(256,Math.min(2048,Math.round(2048*e)))}function lo(e,t){return new re(e,t,{type:E,minFilter:I,magFilter:I,depthBuffer:!1,stencilBuffer:!1,generateMipmaps:!1,colorSpace:``})}function uo(e){let t=new re(e,e,{format:g,type:f,minFilter:I,magFilter:I,depthBuffer:!1,stencilBuffer:!1,generateMipmaps:!1,colorSpace:``});return t.texture.wrapS=C,t.texture.wrapT=C,t}function fo(){let e=new L;return e.setAttribute(`position`,new j(new Float32Array([-1,-1,0,3,-1,0,-1,3,0]),3)),e.setAttribute(`uv`,new j(new Float32Array([0,0,2,0,0,2]),2)),e.boundingSphere=null,e}function po(e,t,n,r,i){let a=(e%r+r)%r,o=(t%r+r)%r,s=(n%r+r)%r,c=Math.imul(a,374761393)+Math.imul(o,668265263)+Math.imul(s,1103515245)+i|0;return c=Math.imul(c^c>>>13,1274126177),((c^c>>>16)>>>0)/4294967296}function mo(e){return e*e*e*(e*(e*6-15)+10)}function ho(e,t,n,r,i){let a=Math.floor(e),o=Math.floor(t),s=Math.floor(n),c=mo(e-a),l=mo(t-o),u=mo(n-s),d=po(a,o,s,r,i),f=po(a+1,o,s,r,i),p=po(a,o+1,s,r,i),m=po(a+1,o+1,s,r,i),h=po(a,o,s+1,r,i),g=po(a+1,o,s+1,r,i),_=po(a,o+1,s+1,r,i),v=po(a+1,o+1,s+1,r,i),y=d+(f-d)*c,b=p+(m-p)*c,x=h+(g-h)*c,S=_+(v-_)*c,C=y+(b-y)*l;return C+(x+(S-x)*l-C)*u}function go(e,t,n,r,i,a){let o=0,s=0,c=1,l=1;for(let u=0;u<i;u+=1)o+=c*ho(e*l,t*l,n*l,r*l,a+u*131),s+=c,c*=.5,l*=2;return s===0?0:o/s}function _o(e,t,n){let r=t*t*t,i=new Float32Array(r*3),a=new H(n);for(let e=0;e<r;e+=1)i[e*3]=a.next(),i[e*3+1]=a.next(),i[e*3+2]=a.next();let o=new Float32Array(e*e*e),s=t/e;for(let n=0;n<e;n+=1){let r=(n+.5)*s,a=Math.floor(r);for(let c=0;c<e;c+=1){let l=(c+.5)*s,u=Math.floor(l);for(let d=0;d<e;d+=1){let f=(d+.5)*s,p=Math.floor(f),m=4;for(let e=-1;e<=1;e+=1){let n=((a+e)%t+t)%t;for(let o=-1;o<=1;o+=1){let s=((u+o)%t+t)%t;for(let c=-1;c<=1;c+=1){let d=((p+c)%t+t)%t,h=((n*t+s)*t+d)*3,g=p+c+(i[h]??0),_=u+o+(i[h+1]??0),v=a+e+(i[h+2]??0),y=g-f,b=_-l,x=v-r,S=y*y+b*b+x*x;S<m&&(m=S)}}}o[(n*e+c)*e+d]=1-Math.min(1,Math.sqrt(m))}}}return o}function vo(e,t,n,r){let i=e*t,a=e*n,o=new Uint8Array(i*a*4);for(let n=0;n<e;n+=1){let a=n%t*e,s=Math.floor(n/t)*e;for(let t=0;t<e;t+=1)for(let c=0;c<e;c+=1)r((n*e+t)*e+c,o,((s+t)*i+a+c)*4)}let s=new _(o,i,a,se,f);return s.wrapS=C,s.wrapT=C,s.minFilter=I,s.magFilter=I,s.generateMipmaps=!1,s.needsUpdate=!0,s}function yo(e){return Math.max(0,Math.min(255,Math.round(G(e,0,1)*255)))}function bo(e){let t=Ba,n=_o(t,4,e),r=_o(t,8,e+1),i=_o(t,16,e+2),a=4096*t,o=new Float32Array(a);for(let n=0;n<t;n+=1)for(let r=0;r<t;r+=1)for(let i=0;i<t;i+=1)o[(n*t+r)*t+i]=go(i/t*4,r/t*4,n/t*4,4,4,e+3);xo(o);let s=new Float32Array(a);for(let e=0;e<a;e+=1){let t=(n[e]??0)*.625+(r[e]??0)*.25+(i[e]??0)*.125;s[e]=hr(t,1,o[e]??0)}return xo(s),vo(t,Va,Ha,(e,t,a)=>{t[a]=yo(s[e]??0),t[a+1]=yo(n[e]??0),t[a+2]=yo(r[e]??0),t[a+3]=yo(i[e]??0)})}function xo(e){let t=1/0,n=-1/0;for(let r=0;r<e.length;r+=1){let i=e[r]??0;i<t&&(t=i),i>n&&(n=i)}let r=Math.max(1e-4,n-t);for(let n=0;n<e.length;n+=1)e[n]=((e[n]??0)-t)/r}function So(e){let t=Ua,n=_o(t,4,e),r=_o(t,8,e+1),i=_o(t,16,e+2);return vo(t,Wa,Ga,(e,t,a)=>{t[a]=yo(n[e]??0),t[a+1]=yo(r[e]??0),t[a+2]=yo(i[e]??0),t[a+3]=255})}function Co(e,t){let n=e*e,r=new Uint8Array(n),i=new Float64Array(n),a=new Float64Array(n),o=new Int32Array(n),s=1.9,c=new Float64Array(121),l=0;for(let e=-5;e<=5;e+=1)for(let t=-5;t<=5;t+=1){let n=Math.exp(-(t*t+e*e)/(2*s*s));c[(e+5)*11+t+5]=n,l+=n}a.fill(l);let u=(t,n)=>{let r=t%e,o=t/e|0;for(let t=-5;t<=5;t+=1){let s=(o+t+e)%e;for(let o=-5;o<=5;o+=1){let l=(r+o+e)%e,u=(c[(t+5)*11+o+5]??0)*n,d=s*e+l;i[d]=(i[d]??0)+u,a[d]=(a[d]??0)-u}}},d=(e,t)=>{r[e]!==t&&(r[e]=t,u(e,t===1?1:-1))},p=(e,t,i)=>{let a=-1,o=i?-1/0:1/0;for(let s=0;s<n;s+=1){if(r[s]!==e)continue;let n=t[s]??0;(i?n>o:n<o)&&(o=n,a=s)}return a},m=new H(t),h=Math.max(1,Math.round(n/10)),g=0;for(;g<h;){let e=m.int(0,n-1);r[e]!==1&&(d(e,1),g+=1)}for(let e=0;e<n*4;e+=1){let e=p(1,i,!0);if(e<0)break;d(e,0);let t=p(0,i,!1);if(t<0||t===e){d(e,1);break}d(t,1)}let y=r.slice();for(let e=g-1;e>=0;--e){let t=p(1,i,!0);if(t<0)break;d(t,0),o[t]=e}for(let e=0;e<n;e+=1)d(e,y[e]??0);let b=n>>1;for(let e=g;e<b;e+=1){let t=p(0,i,!1);if(t<0)break;d(t,1),o[t]=e}for(let e=b;e<n;e+=1){let t=p(0,a,!0);if(t<0)break;d(t,1),o[t]=e}let x=new Uint8Array(n*4);for(let e=0;e<n;e+=1){let t=Math.min(255,Math.round((o[e]??0)/n*256)),r=e*4;x[r]=t,x[r+1]=t,x[r+2]=t,x[r+3]=255}let S=new _(x,e,e,se,f);return S.wrapS=v,S.wrapT=v,S.minFilter=I,S.magFilter=I,S.generateMipmaps=!1,S.needsUpdate=!0,S}var wo=new a(.72,.8,1),To=new a(1,.96,.92),Eo=new a(1,.62,.36),Do=new a;function Oo(){return{uSunDirection:{value:new t(0,1,0)},uSunColour:{value:new a(1,1,1)},uSunIlluminance:{value:0},uMoonDirection:{value:new t(0,-1,0)},uMoonColour:{value:wo.clone()},uMoonIlluminance:{value:0},uEnvironment:{value:null},uEnvironmentIntensity:{value:1},uVisibility:{value:25e3}}}function ko(e){let t=e.get(`sky`);return t===void 0?null:t.probe.cubeTexture}function Ao(e,t,n){let r=t.world,i=e.uEnvironment;i!==void 0&&(i.value=n),jo(e,`uVisibility`,r.visibility);let a=r.ephemeris;if(a===null)return;let o=e.uSunDirection;o!==void 0&&o.value.set(a.sunDirectionRefracted.x,a.sunDirectionRefracted.y,a.sunDirectionRefracted.z);let s=e.uMoonDirection;s!==void 0&&s.value.set(a.moonDirection.x,a.moonDirection.y,a.moonDirection.z);let c=1-W(0,18,a.sunAltitudeDeg);Do.copy(To).lerp(Eo,c*c);let l=e.uSunColour;l!==void 0&&l.value.copy(Do);let u=1-r.cloudiness*.9;jo(e,`uSunIlluminance`,a.sunIlluminanceLux/Math.PI*u),jo(e,`uMoonIlluminance`,a.moonIlluminanceLux/Math.PI*u),jo(e,`uEnvironmentIntensity`,1),jo(e,`uVisibility`,r.visibility)}function jo(e,t,n){let r=e[t];r!==void 0&&(r.value=n)}var Mo=`precision highp float;

#ifndef ENDLESS_FISHING_CONSTANTS\r
#define ENDLESS_FISHING_CONSTANTS

const float PI = 3.14159265358979323846;\r
const float TWO_PI = 6.28318530717958647692;\r
const float HALF_PI = 1.57079632679489661923;\r
const float INV_PI = 0.31830988618379067154;\r
const float INV_FOUR_PI = 0.07957747154594766788;\r
const float DEG_TO_RAD = 0.01745329251994329577;\r
const float RAD_TO_DEG = 57.2957795130823208768;

const float EPS = 1e-6;

#ifndef saturate\r
float saturate(float x) { return clamp(x, 0.0, 1.0); }\r
vec2 saturate(vec2 x) { return clamp(x, 0.0, 1.0); }\r
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }\r
#endif

float ef_luminance(vec3 colour) {\r
  return dot(colour, vec3(0.2126, 0.7152, 0.0722));\r
}

float remap(float x, float lowIn, float highIn, float lowOut, float highOut) {\r
  float span = highIn - lowIn;\r
  float t = span == 0.0 ? step(lowIn, x) : (x - lowIn) / span;\r
  return lowOut + saturate(t) * (highOut - lowOut);\r
}

vec3 hdrClamp(vec3 colour) {\r
  vec3 safe;\r
  safe.x = colour.x == colour.x ? colour.x : 0.0;\r
  safe.y = colour.y == colour.y ? colour.y : 0.0;\r
  safe.z = colour.z == colour.z ? colour.z : 0.0;\r
  
  
  return clamp(safe, vec3(0.0), vec3(60000.0));\r
}

float hdrClampAlpha(float alpha) {\r
  return clamp(alpha == alpha ? alpha : 0.0, 0.0, 1.0);\r
}

#endif\r

attribute vec3 aCorner;

attribute vec3 aOffset;\r
attribute vec2 aSeed;\r

uniform vec3 uBox;

uniform vec3 uDrift;

uniform vec3 uStreak;

uniform vec2 uHalfResolution;

uniform float uWidthPx;

uniform float uFill;

uniform float uWaterLevel;

varying vec3 vWorldPosition;\r
varying float vFade;\r
varying vec2 vQuad;

void main() {\r
  vQuad = vec2(aCorner.x * 2.0, aCorner.y);\r
  vFade = 0.0;\r
  vWorldPosition = cameraPosition;

  
  
  if (aSeed.x >= uFill) {\r
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);\r
    return;\r
  }

  vec3 head = cameraPosition + mod(aOffset + uDrift - cameraPosition + uBox * 0.5, uBox) - uBox * 0.5;\r
  vWorldPosition = head;\r
  
  
  vec3 streak = uStreak * (0.7 + 0.6 * aSeed.y);

  vec4 clipHead = projectionMatrix * viewMatrix * vec4(head, 1.0);\r
  vec4 clipTail = projectionMatrix * viewMatrix * vec4(head + streak, 1.0);\r
  
  
  if (clipHead.w <= EPS || clipTail.w <= EPS) {\r
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);\r
    return;\r
  }

  vec2 pixelHead = clipHead.xy / clipHead.w * uHalfResolution;\r
  vec2 pixelTail = clipTail.xy / clipTail.w * uHalfResolution;\r
  vec2 along = pixelTail - pixelHead;\r
  float lengthPx = length(along);\r
  
  
  vec2 direction = lengthPx > 1e-3 ? along / lengthPx : vec2(0.0, 1.0);\r
  vec2 across = vec2(-direction.y, direction.x) * (uWidthPx * 0.5 * aCorner.x);

  vec4 clip = mix(clipHead, clipTail, aCorner.y);\r
  clip.xy += across / uHalfResolution * clip.w;\r
  gl_Position = clip;

  float distanceToEye = distance(head, cameraPosition);\r
  
  
  vFade =\r
      smoothstep(0.4, 1.4, distanceToEye) *\r
      (1.0 - smoothstep(uBox.x * 0.30, uBox.x * 0.46, distanceToEye)) *\r
      smoothstep(uWaterLevel - 0.1, uWaterLevel + 1.0, head.y) *\r
      
      (1.0 - smoothstep(uFill - 0.08, uFill, aSeed.x));\r
}`,No=`precision highp float;

#ifndef ENDLESS_FISHING_WORLDLIGHT\r
#define ENDLESS_FISHING_WORLDLIGHT

#ifndef ENDLESS_FISHING_CONSTANTS\r
#define ENDLESS_FISHING_CONSTANTS

const float PI = 3.14159265358979323846;\r
const float TWO_PI = 6.28318530717958647692;\r
const float HALF_PI = 1.57079632679489661923;\r
const float INV_PI = 0.31830988618379067154;\r
const float INV_FOUR_PI = 0.07957747154594766788;\r
const float DEG_TO_RAD = 0.01745329251994329577;\r
const float RAD_TO_DEG = 57.2957795130823208768;

const float EPS = 1e-6;

#ifndef saturate\r
float saturate(float x) { return clamp(x, 0.0, 1.0); }\r
vec2 saturate(vec2 x) { return clamp(x, 0.0, 1.0); }\r
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }\r
#endif

float ef_luminance(vec3 colour) {\r
  return dot(colour, vec3(0.2126, 0.7152, 0.0722));\r
}

float remap(float x, float lowIn, float highIn, float lowOut, float highOut) {\r
  float span = highIn - lowIn;\r
  float t = span == 0.0 ? step(lowIn, x) : (x - lowIn) / span;\r
  return lowOut + saturate(t) * (highOut - lowOut);\r
}

vec3 hdrClamp(vec3 colour) {\r
  vec3 safe;\r
  safe.x = colour.x == colour.x ? colour.x : 0.0;\r
  safe.y = colour.y == colour.y ? colour.y : 0.0;\r
  safe.z = colour.z == colour.z ? colour.z : 0.0;\r
  
  
  return clamp(safe, vec3(0.0), vec3(60000.0));\r
}

float hdrClampAlpha(float alpha) {\r
  return clamp(alpha == alpha ? alpha : 0.0, 0.0, 1.0);\r
}

#endif\r
#ifndef ENDLESS_FISHING_AIRLIGHT\r
#define ENDLESS_FISHING_AIRLIGHT

vec3 ef_airLight(samplerCube environment, float intensity, vec3 V) {\r
  vec3 direction = normalize(vec3(-V.x, max(-V.y, 0.07), -V.z) + vec3(EPS, 0.0, 0.0));\r
  return textureCubeLodEXT(environment, direction, 1.0).rgb * intensity;\r
}

#endif

uniform vec3 uSunDirection;\r
uniform vec3 uSunColour;

uniform float uSunIlluminance;\r
uniform vec3 uMoonDirection;\r
uniform vec3 uMoonColour;\r
uniform float uMoonIlluminance;

uniform samplerCube uEnvironment;\r
uniform float uEnvironmentIntensity;

uniform float uVisibility;

float ef_ggx(float nDotH, float roughness) {\r
  float a = roughness * roughness;\r
  float a2 = a * a;\r
  float d = nDotH * nDotH * (a2 - 1.0) + 1.0;\r
  return a2 / max(EPS, PI * d * d);\r
}

float ef_smith(float nDotV, float nDotL, float roughness) {\r
  float k = roughness * roughness * 0.5;\r
  return (nDotV / (nDotV * (1.0 - k) + k)) * (nDotL / (nDotL * (1.0 - k) + k));\r
}

vec3 ef_fresnel(float cosTheta, vec3 f0) {\r
  float m = clamp(1.0 - cosTheta, 0.0, 1.0);\r
  float m2 = m * m;\r
  return f0 + (1.0 - f0) * m2 * m2 * m;\r
}

vec3 ef_directLight(\r
    vec3 L, vec3 colour, float illuminance,\r
    vec3 N, vec3 V, vec3 albedo, vec3 f0, float roughness) {\r
  if (illuminance <= 0.0) return vec3(0.0);

  float nDotL = dot(N, L);\r
  if (nDotL <= 0.0) return vec3(0.0);

  float horizon = smoothstep(-0.035, 0.02, L.y);\r
  if (horizon <= 0.0) return vec3(0.0);

  float nDotV = max(1e-3, dot(N, V));\r
  vec3 H = normalize(L + V);\r
  float nDotH = max(0.0, dot(N, H));

  float D = ef_ggx(nDotH, roughness);\r
  float G = ef_smith(nDotV, nDotL, roughness);\r
  vec3 F = ef_fresnel(max(0.0, dot(H, V)), f0);\r
  vec3 specular = (D * G / (4.0 * nDotV * nDotL + EPS)) * F;

  return colour * illuminance * nDotL * horizon * (albedo * INV_PI * (1.0 - F) + specular);\r
}

vec3 ef_shadeSurface(vec3 albedo, vec3 N, vec3 V, float roughness, float occlusion, vec3 f0) {\r
  vec3 colour = vec3(0.0);\r
  colour += ef_directLight(uSunDirection, uSunColour, uSunIlluminance, N, V, albedo, f0, roughness);\r
  colour += ef_directLight(uMoonDirection, uMoonColour, uMoonIlluminance, N, V, albedo, f0, roughness);

  
  
  
  vec3 irradiance = textureCubeLodEXT(uEnvironment, N, 6.0).rgb * uEnvironmentIntensity;\r
  vec3 R = reflect(-V, N);\r
  vec3 reflection = textureCubeLodEXT(uEnvironment, R, roughness * 7.0).rgb * uEnvironmentIntensity;

  float nDotV = max(1e-3, dot(N, V));\r
  vec3 F = ef_fresnel(nDotV, f0);\r
  colour += albedo * irradiance * occlusion;\r
  colour += reflection * F * occlusion;

  return colour;\r
}

vec3 ef_aerialPerspective(vec3 colour, float distanceToCamera, vec3 V) {\r
  float extinction = 3.912 / max(200.0, uVisibility);\r
  float t = 1.0 - exp(-extinction * distanceToCamera);\r
  return mix(colour, ef_airLight(uEnvironment, uEnvironmentIntensity, V), t);\r
}

#endif

varying vec3 vWorldPosition;
varying float vFade;
varying vec2 vQuad;

uniform float uOpacity;

void main() {
  if (vFade <= 0.002) discard;

  vec3 viewVector = cameraPosition - vWorldPosition;
  vec3 V = viewVector / max(EPS, length(viewVector));

  
  
  vec3 gather = normalize(mix(-V, vec3(0.0, 1.0, 0.0), 0.55));
  vec3 colour = textureCubeLodEXT(uEnvironment, gather, 5.0).rgb * uEnvironmentIntensity;

  
  float sunThrough = pow(max(0.0, dot(V, -uSunDirection)), 7.0);
  float moonThrough = pow(max(0.0, dot(V, -uMoonDirection)), 7.0);
  colour += uSunColour * uSunIlluminance * sunThrough * 0.6;
  colour += uMoonColour * uMoonIlluminance * moonThrough * 0.6;

  
  
  float across = 1.0 - vQuad.x * vQuad.x;
  float taper = 1.0 - 0.55 * vQuad.y;
  float alpha = hdrClampAlpha(uOpacity * vFade * across * taper);
  if (alpha <= 0.002) discard;

  gl_FragColor = vec4(hdrClamp(colour), alpha);
}`,Po=14e3,Fo=new t(48,30,48),Io=1/48,Lo=2.6,Ro=.3,zo=new t,Bo=class{name=`rain`;priority=25;geometry;material;mesh;drift=new t;fill=0;constructor(n){let r=new H(168940043);this.geometry=new O,this.geometry.setAttribute(`aCorner`,new j(new Float32Array([-.5,0,0,.5,0,0,-.5,1,0,.5,1,0]),3)),this.geometry.setIndex([0,1,2,2,1,3]);let a=new Float32Array(Po*3),o=new Float32Array(Po*2);for(let e=0;e<Po;e+=1)a[e*3]=r.range(0,Fo.x),a[e*3+1]=r.range(0,Fo.y),a[e*3+2]=r.range(0,Fo.z),o[e*2]=r.range(0,1),o[e*2+1]=r.range(0,1);this.geometry.setAttribute(`aOffset`,new w(a,3)),this.geometry.setAttribute(`aSeed`,new w(o,2)),this.geometry.boundingSphere=null,this.material=new i({vertexShader:Mo,fragmentShader:No,uniforms:{...Oo(),uBox:{value:Fo.clone()},uDrift:{value:new t},uStreak:{value:new t},uHalfResolution:{value:new x(1,1)},uWidthPx:{value:Lo},uFill:{value:0},uWaterLevel:{value:0},uOpacity:{value:Ro}},transparent:!0,depthWrite:!1,depthTest:!0,blending:1,side:2}),this.mesh=new e(this.geometry,this.material),this.mesh.frustumCulled=!1,this.mesh.renderOrder=40,this.mesh.visible=!1,n.scene.add(this.mesh),n.resources.track(this.geometry),n.resources.track(this.material),this.onSettingsChanged(n)}update(e,t){let n=t.world,r=this.material.uniforms,i=G((n.precipitation-.02)/.5,0,1);if(this.fill=K(this.fill,i,.8,Math.min(e,.1)),this.mesh.visible=this.fill>.004,!this.mesh.visible)return;Ao(r,t,ko(t));let a=n.windX,o=-8.8,s=n.windZ;this.drift.set((this.drift.x+a*e+Fo.x)%Fo.x,(this.drift.y+o*e+Fo.y)%Fo.y,(this.drift.z+s*e+Fo.z)%Fo.z),(r.uDrift?.value)?.copy(this.drift),zo.set(a*Io,o*Io,s*Io),(r.uStreak?.value)?.copy(zo);let c=r.uFill;c!==void 0&&(c.value=this.fill);let l=r.uWaterLevel;l!==void 0&&(l.value=n.tideHeight);let u=r.uOpacity;u!==void 0&&(u.value=Ro*(.72+.5*n.precipitation));let d=r.uHalfResolution;d!==void 0&&d.value.set(t.width*t.pixelRatio*.5,t.height*t.pixelRatio*.5)}onSettingsChanged(e){let t=G(e.settings.graphics.instanceDensity,.1,1);this.geometry.instanceCount=Math.max(1,Math.round(Po*t))}dispose(){this.mesh.removeFromParent(),this.geometry.dispose(),this.material.dispose()}};function Vo(){return{liftR:0,liftG:0,liftB:0,gammaR:1,gammaG:1,gammaB:1,gainR:1,gainG:1,gainB:1,saturation:1,temperature:0,tint:0}}var Ho={lift:[-.005,-.002,.008],gamma:[1.03,1.015,1],gain:.99,saturation:.93,temperature:-.05,tint:.012},Uo={lift:[.003,0,.005],gamma:[1,1.005,.995],gain:.995,saturation:1.06,temperature:-.02,tint:-.035},Wo={lift:[-.002,-.001,.005],gamma:[.995,1,1.005],gain:1,saturation:1.05,temperature:.055,tint:0},Go={lift:[0,0,0],gamma:[1,1,1],gain:1,saturation:1.02,temperature:0,tint:0},Ko=-16,qo=-8,Jo=-7,Yo=-1,Xo=5,Zo=13,Qo=[.005,.006,.008],$o=.022,es=.02,ts=.12,ns=.035,rs=.45,is=.22,as=.2126,os=.7152,ss=.0722;function cs(e,t,n){e.liftR+=n*t.lift[0],e.liftG+=n*t.lift[1],e.liftB+=n*t.lift[2],e.gammaR+=n*t.gamma[0],e.gammaG+=n*t.gamma[1],e.gammaB+=n*t.gamma[2],e.gainR+=n*t.gain,e.gainG+=n*t.gain,e.gainB+=n*t.gain,e.saturation+=n*t.saturation,e.temperature+=n*t.temperature,e.tint+=n*t.tint}function ls(e,t,n,r,i){let a=W(Ko,qo,e),o=W(Jo,Yo,e),s=W(Xo,Zo,e);i.liftR=0,i.liftG=0,i.liftB=0,i.gammaR=0,i.gammaG=0,i.gammaB=0,i.gainR=0,i.gainG=0,i.gainB=0,i.saturation=0,i.temperature=0,i.tint=0,cs(i,Ho,1-a),cs(i,Uo,a*(1-o)),cs(i,Wo,o*(1-s)),cs(i,Go,s);let c=W(.55,.95,G(t,0,1)),l=W(.05,.5,G(n,0,1)),u=W(5,9,G(r,0,12)),d=.5*c+.32*l+.18*u;i.liftR+=Qo[0]*d,i.liftG+=Qo[1]*d,i.liftB+=Qo[2]*d,i.gammaR-=$o*d,i.gammaG-=$o*d,i.gammaB-=$o*d;let f=1-es*d;i.gainR*=f,i.gainG*=f,i.gainB*=f,i.saturation*=1-ts*d,i.temperature-=ns*d,us(i)}function us(e){let t=1+rs*e.temperature-is*e.tint,n=1+rs*e.tint,r=1-rs*e.temperature-is*e.tint,i=as*t+os*n+ss*r,a=i>1e-4?1/i:1;e.gainR*=t*a,e.gainG*=n*a,e.gainB*=r*a}var ds=`uniform float exposure;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  outputColor = vec4(inputColor.rgb * exposure, inputColor.a);
}`,fs=`uniform vec3 uLift;\r
uniform vec3 uGamma;\r
uniform vec3 uGain;\r
uniform float uSaturation;\r

float ef_gradientNoise(vec2 fragment) {\r
  return fract(52.9829189 * fract(dot(fragment, vec2(0.06711056, 0.00583715))));\r
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {\r
  
  
  
  
  
  
  vec3 display = pow(max(inputColor.rgb, vec3(0.0)), vec3(1.0 / 2.2));

  display = display * uGain + uLift;

  
  
  
  vec3 graded = pow(max(display, vec3(0.0)), uGamma * 2.2);

  
  
  
  float grey = dot(graded, vec3(0.2126, 0.7152, 0.0722));\r
  vec3 result = mix(vec3(grey), graded, uSaturation);

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  vec2 fragment = gl_FragCoord.xy;\r
  float dither = ef_gradientNoise(fragment) - ef_gradientNoise(fragment + vec2(37.0, 17.0));\r
  result += dither / 255.0;

  
  
  
  outputColor = vec4(clamp(result, 0.0, 1.0), inputColor.a);\r
}`,ps=class extends ce{constructor(){super(`ExposureEffect`,ds,{blendFunction:Ce.SRC,uniforms:new Map([[`exposure`,new ye(1)]])})}set exposure(e){let t=this.uniforms.get(`exposure`);t!==void 0&&(t.value=e)}},ms=class extends ce{lift;gamma;gain;constructor(){let e=new t(0,0,0),n=new t(1,1,1),r=new t(1,1,1);super(`ColourGradeEffect`,fs,{blendFunction:Ce.SRC,uniforms:new Map([[`uLift`,new ye(e)],[`uGamma`,new ye(n)],[`uGain`,new ye(r)],[`uSaturation`,new ye(1)]])}),this.lift=e,this.gamma=n,this.gain=r}setGrade(e){this.lift.set(e.liftR,e.liftG,e.liftB),this.gamma.set(e.gammaR,e.gammaG,e.gammaB),this.gain.set(e.gainR,e.gainG,e.gainB);let t=this.uniforms.get(`uSaturation`);t!==void 0&&(t.value=e.saturation)}},hs=class{name=`postfx`;priority=90;composer;exposureEffect=new ps;bloom;toneMapping;grade=new ms;gradeParams=Vo();vignette;noise;chromaticAberration;smaa;effectPasses=[];retiredPasses=[];renderPass;smoothedExposure=1;constructor(e){let t=e.renderer;this.composer=new te(t,{frameBufferType:E,multisampling:0}),this.renderPass=new M(e.scene,e.camera),this.composer.addPass(this.renderPass),this.bloom=new me({blendFunction:Ce.SCREEN,luminanceThreshold:1.05,luminanceSmoothing:.28,mipmapBlur:!0,intensity:.62,radius:.72,levels:7}),this.toneMapping=new ne({mode:ae.ACES_FILMIC,resolution:256,whitePoint:4,middleGrey:.6}),this.vignette=new ve({offset:.32,darkness:.42}),this.noise=new xe({blendFunction:Ce.OVERLAY,premultiply:!0}),this.noise.blendMode.opacity.value=.04,this.chromaticAberration=new be({radialModulation:!0,modulationOffset:.42}),this.chromaticAberration.offset.set(28e-5,28e-5),this.smaa=new de({preset:Te.HIGH}),this.rebuildPasses(e),t.toneMapping=0,e.renderOverride=e=>{this.composer.render(e)}}update(e,t){this.smoothedExposure=K(this.smoothedExposure,t.world.exposure,12,Math.min(e,.1)),this.exposureEffect.exposure=this.smoothedExposure;let n=t.world.ephemeris;n!==null&&t.settings.graphics.gradeEnabled&&(ls(n.sunAltitudeDeg,t.world.cloudiness,t.world.precipitation,t.world.beaufort,this.gradeParams),this.grade.setGrade(this.gradeParams))}onSettingsChanged(e){this.rebuildPasses(e)}resize(e,t){this.composer.setSize(e,t)}dispose(){for(let e of this.retiredPasses)e.dispose();this.retiredPasses.length=0,this.composer.dispose()}rebuildPasses(e){for(let e of this.effectPasses)this.composer.removePass(e);this.retiredPasses.push(...this.effectPasses),this.effectPasses=[];let t=e.settings.graphics;this.effectPasses.push(new ge(e.camera,this.exposureEffect));let n=[];t.bloomEnabled&&n.push(this.bloom),n.push(this.toneMapping),t.gradeEnabled&&n.push(this.grade),t.vignetteEnabled&&n.push(this.vignette),t.grainEnabled&&n.push(this.noise),this.effectPasses.push(new ge(e.camera,...n)),t.chromaticAberrationEnabled&&this.effectPasses.push(new ge(e.camera,this.chromaticAberration)),t.antialias===`smaa`&&this.effectPasses.push(new ge(e.camera,this.smaa));for(let e of this.effectPasses)this.composer.addPass(e)}},gs=`processed/`,_s=`${gs}manifest.json`,vs=class{resources;variants=new Map;resolved=new Map;materials=new Set;clones=new Set;entries=null;constructor(e){this.resources=e}load(e,t={}){let n=ys(e,t),r=this.variants.get(n);if(r!==void 0)return r;let i=this.build(e,n,t);return this.variants.set(n,i),i}get(e){return this.resolved.get(e)}dispose(){for(let e of this.materials)e.dispose();for(let e of this.clones)e.dispose();this.materials.clear(),this.clones.clear(),this.variants.clear(),this.resolved.clear(),this.entries=null}manifest(){let e=this.entries;if(e!==null)return e;let t=this.resources.loadBinary(_s).then(e=>{let t=JSON.parse(new TextDecoder().decode(e));if(!Array.isArray(t.materials)||t.materials.length===0)throw Error("assets/processed/manifest.json lists no materials — run `npm run textures`");let n=new Map;for(let e of t.materials)n.set(e.id,e);return n});return this.entries=t,t}async build(e,t,n){let r=await this.manifest(),i=r.get(e);if(i===void 0)throw Error(`Unknown material "${e}". The processed manifest holds: ${[...r.keys()].join(`, `)}`);let a=n.repeat??1,o=a*(i.stretched&&i.sourceHeight>0?i.sourceWidth/i.sourceHeight:1),[s,c,l]=await Promise.all([this.resources.loadTexture(gs+i.maps.albedo,{srgb:!0}),this.resources.loadTexture(gs+i.maps.normal,{srgb:!1}),this.resources.loadTexture(gs+i.maps.orm,{srgb:!1})]),u=this.variantTexture(l,a,o),d=n.normalScale??1,f=new we({name:t,map:this.variantTexture(s,a,o),normalMap:this.variantTexture(c,a,o),aoMap:u,roughnessMap:u,metalnessMap:u,roughness:n.roughness??1,metalness:n.metalness??1,envMapIntensity:1});return n.color!==void 0&&f.color.setHex(n.color),f.normalScale.set(d,d),this.materials.add(f),this.resolved.set(t,f),this.resolved.has(e)||this.resolved.set(e,f),f}variantTexture(e,t,n){let r=e.clone();return r.repeat.set(t,n),r.needsUpdate=!0,this.clones.add(r),r}};function ys(e,t){return[e,t.repeat??1,t.roughness??1,t.metalness??1,(t.color??16777215).toString(16),t.normalScale??1].join(`|`)}var bs=1025,xs=9.80665,Ss={length:7.2,beam:2.6,designDraught:.52,halfBeamAt(e){return e<.62?.02+.98*W(0,1,(e/.62)**.85):1-.17*W(0,1,(e-.62)/.38)},keelAt(e){let t=1-W(0,.3,e),n=W(.78,1,e);return-Ss.designDraught*(1-.82*t**1.4-.28*n)},sheerAt(e){return .78+.4*(1-W(0,.45,e))**1.6+.1*W(.55,1,e)}};function Cs(e,n=5){let r=[],i=e.length/n;for(let a=0;a<n;a+=1){let o=(a+.5)/n,s=e.beam/2*e.halfBeamAt(o),c=e.keelAt(o),l=-e.length/2+o*e.length,u=Math.max(.05,e.sheerAt(o)-c),d=i*s;for(let e of[-1,1])r.push({offset:new t(e*s/2,c,l),area:d,span:u})}return r}function ws(e,t){let n=0;for(let r of e)n+=r.area*G(t-r.offset.y,0,r.span);return n}function Ts(e,t=bs){return ws(e,0)*t}var Es=30,Ds=6,Os=new t,ks=new t,As=new t,js=new t,Ms=new t,Ns=new t,Ps=new t,Fs=new t,Is=new t,Ls=new t,Rs=new P,zs=new P,Bs=class{position=new t;orientation=new P;velocity=new t;angularVelocity=new t;config;submergedVolume=0;wettedFraction=0;verticalAcceleration=0;forceAccumulator=new t;torqueAccumulator=new t;inertia=new t;inverseInertia=new t;constructor(e){this.config=e,this.refreshInertia()}refreshInertia(){let{mass:e,halfExtents:t}=this.config,n=(2*t.x)**2,r=(2*t.y)**2,i=(2*t.z)**2;this.inertia.set(e*(r+i)/12,e*(n+i)/12,e*(n+r)/12),this.inverseInertia.set(1/this.inertia.x,1/this.inertia.y,1/this.inertia.z)}addForce(e,t){this.forceAccumulator.add(e),t!==null&&(ks.copy(t).sub(this.position),Ns.copy(ks).cross(e),this.torqueAccumulator.add(Ns))}addTorque(e){this.torqueAccumulator.add(e)}localToWorld(e,t){return t.copy(e).applyQuaternion(this.orientation).add(this.position)}step(e,t){let{mass:n,probes:r,waterDensity:i,dragArea:a,dragCoefficient:o}=this.config,s=this.velocity.y,c=0,l=0;Rs.copy(this.orientation).invert();for(let e of r){this.localToWorld(e.offset,Os);let n=G(t(Os.x,Os.z)-Os.y,0,e.span);if(n<=0)continue;let s=e.area*n;c+=s,l+=1,ks.copy(Os).sub(this.position),As.set(0,i*xs*s,0),this.forceAccumulator.add(As),this.torqueAccumulator.add(Ns.copy(ks).cross(As)),js.copy(this.angularVelocity).cross(ks).add(this.velocity),Ms.copy(js).applyQuaternion(Rs);let u=n/e.span,d=-.5*i*o*u/r.length;Ms.set(d*a.x*Math.abs(Ms.x)*Ms.x,d*a.y*Math.abs(Ms.y)*Ms.y,d*a.z*Math.abs(Ms.z)*Ms.z),As.copy(Ms).applyQuaternion(this.orientation),this.forceAccumulator.add(As),this.torqueAccumulator.add(Ns.copy(ks).cross(As))}this.submergedVolume=c,this.wettedFraction=r.length===0?0:l/r.length,this.forceAccumulator.y-=n*xs;let u=this.wettedFraction;this.forceAccumulator.addScaledVector(this.velocity,-this.config.linearDamping*n*u),this.torqueAccumulator.addScaledVector(this.angularVelocity,-this.config.angularDamping*u),this.velocity.addScaledVector(this.forceAccumulator,e/n),this.velocity.lengthSq()>900&&this.velocity.setLength(Es),this.position.addScaledVector(this.velocity,e),Is.copy(this.torqueAccumulator).applyQuaternion(Rs),Ps.copy(this.angularVelocity).applyQuaternion(Rs),Fs.set(Ps.x*this.inertia.x,Ps.y*this.inertia.y,Ps.z*this.inertia.z),Fs.cross(Ps).add(Is),Ls.set(Fs.x*this.inverseInertia.x,Fs.y*this.inverseInertia.y,Fs.z*this.inverseInertia.z).applyQuaternion(this.orientation),this.angularVelocity.addScaledVector(Ls,e),this.angularVelocity.lengthSq()>36&&this.angularVelocity.setLength(Ds),zs.set(this.angularVelocity.x,this.angularVelocity.y,this.angularVelocity.z,0),zs.multiply(this.orientation),this.orientation.set(this.orientation.x+zs.x*.5*e,this.orientation.y+zs.y*.5*e,this.orientation.z+zs.z*.5*e,this.orientation.w+zs.w*.5*e),this.orientation.normalize(),this.verticalAcceleration=(this.velocity.y-s)/e,this.forceAccumulator.set(0,0,0),this.torqueAccumulator.set(0,0,0)}},J=Ss,Vs=J.length/2,Hs=32,Us=5,Ws=.42,Gs=.94,Ks=.3,qs=.22,Js=.17,Ys=.05,Xs=[[0,1,2],[2,3,4]],Zs=3.2,Qs=new x,$s=new x,ec=new t;function tc(e,t,n){let r=J.beam/2*J.halfBeamAt(e),i=J.keelAt(e),a=J.sheerAt(e),o=i+Ws*(a-i),s=r*Gs;switch(t){case 0:return n.set(0,i);case 1:return n.set(s*.55,i+.12*(o-i));case 2:return n.set(s,o);case 3:return n.set(r*.99,o+.5*(a-o));default:return n.set(r,a)}}function nc(e,t){let n=0,r=0,i=J.keelAt(e);for(let a=1;a<=t;a+=1)tc(e,a,Qs),n+=Math.hypot(Qs.x-r,Qs.y-i),r=Qs.x,i=Qs.y;return n}function rc(e,t){let n=0,r=J.keelAt(e);for(let i=1;i<Us;i+=1){if(tc(e,i,Qs),t<=Qs.y){let e=Qs.y-r,i=e<=1e-6?0:G((t-r)/e,0,1);return n+(Qs.x-n)*i}n=Qs.x,r=Qs.y}return n}function Y(e,t){let n=J.sheerAt(e)-t,r=1-W(0,.24,e),i=W(.86,1,e);return-Vs+e*J.length+Ks*r*n-qs*i*n}function ic(e){return J.sheerAt(e)-Js}function ac(e){if(e.hasAttribute(`normal`)||e.computeVertexNormals(),e.hasAttribute(`uv`)&&!e.hasAttribute(`uv1`)){let t=e.getAttribute(`uv`);e.setAttribute(`uv1`,new j(new Float32Array(t.array),2))}return e}function oc(e,t,n){let r=new L;return r.setAttribute(`position`,new j(new Float32Array(e),3)),r.setAttribute(`uv`,new j(new Float32Array(t),2)),r.setIndex(n),r.computeVertexNormals(),r}function sc(e,t,n){if(!e.hasAttribute(`uv`))return e;let r=e.getAttribute(`uv`);for(let e=0;e<r.count;e+=1)r.setXY(e,r.getX(e)*t,r.getY(e)*n);return r.needsUpdate=!0,e}function cc(e,t,n){return sc(new R(e,t,n),Math.max(e,n),t)}function lc(e,n){let r=[],i=[],a=[],o=n.length+1,s=[0];for(let e=1;e<o;e+=1){let t=n[e-1]??$s,r=n[e%n.length]??$s;s.push((s[e-1]??0)+t.distanceTo(r))}let c=new t,l=new t,u=new t,d=new t(0,1,0),f=0;for(let t=0;t<e.length;t+=1){let a=e[t]??ec,p=e[Math.max(0,t-1)]??ec,m=e[Math.min(e.length-1,t+1)]??ec;c.copy(m).sub(p),c.lengthSq()<1e-12&&c.set(0,0,1),c.normalize(),l.copy(d).cross(c),l.lengthSq()<1e-8&&l.set(1,0,0),l.normalize(),u.copy(c).cross(l),t>0&&(f+=a.distanceTo(p));for(let e=0;e<o;e+=1){let t=n[e%n.length]??$s;r.push(a.x+l.x*t.x+u.x*t.y,a.y+l.y*t.x+u.y*t.y,a.z+l.z*t.x+u.z*t.y),i.push(s[e]??0,f)}}for(let t=0;t+1<e.length;t+=1)for(let e=0;e+1<o;e+=1){let n=t*o+e,r=n+1,i=n+o,s=i+1;a.push(n,r,i,r,s,i)}return oc(r,i,a)}function uc(e,t){let n=[];for(let r=0;r<t;r+=1){let i=r/t*Math.PI*2;n.push(new x(Math.cos(i)*e,Math.sin(i)*e))}return n}function dc(e,t){return[new x(e,-t),new x(e,t),new x(-e,t),new x(-e,-t)]}var fc=class extends n{span;a;x0;c;constructor(e,t,n){super(),this.span=e;let r=Math.max(n,Math.hypot(e,t)*1.002),i=Math.sqrt(Math.max(1e-9,r*r-t*t)),a=.001,o=1e5;for(let t=0;t<90;t+=1){let t=(a+o)*.5;2*t*Math.sinh(e/(2*t))>i?a=t:o=t}this.a=(a+o)*.5,this.x0=e/2-this.a*Math.atanh(G(t/r,-.999999,.999999)),this.c=-this.a*Math.cosh(this.x0/this.a)}get sag(){return Math.abs(this.c+this.a)}getPoint(e,n=new t){let r=e*this.span;return n.set(r,this.a*Math.cosh((r-this.x0)/this.a)+this.c,0)}};function pc(n,r,i,a,o){let s=Math.hypot(r.x-n.x,r.z-n.z),c=r.y-n.y,l=Math.hypot(s,c),u=new fc(s,c,l*(1+i)),d=ac(sc(new m(u,40,a,7,!1),l*(1+i),Math.PI*2*a)),f=new le;f.position.copy(n),f.rotation.y=Math.atan2(-(r.z-n.z),r.x-n.x);let p=new le;f.add(p);let h=new e(d,o);return h.castShadow=!0,p.add(h),{root:f,pivot:p,axis:new t(s,c,0).normalize(),response:G(u.sag*.06,.004,.05),mesh:h}}function mc(){let e=[],t=[],n=[],r=new x;for(let i of[1,-1])for(let a of Xs){let o=a.length,s=e.length/3;for(let n=0;n<=Hs;n+=1){let s=n/Hs;for(let n=0;n<o;n+=1){let o=a[n]??0;tc(s,o,r),e.push(i*r.x,r.y,Y(s,r.y)),t.push(i*nc(s,o),s*J.length)}}for(let e=0;e<Hs;e+=1)for(let t=0;t+1<o;t+=1){let r=s+e*o+t,a=r+1,c=r+o,l=c+1;i>0?n.push(r,a,c,a,l,c):n.push(r,c,a,a,c,l)}}return oc(e,t,n)}function hc(){let e=[],t=[],n=[],r=new x,i=(J.keelAt(1)+J.sheerAt(1))*.5;e.push(0,i,Y(1,i)+.01),t.push(0,i);let a=[];for(let e=0;e<Us;e+=1)tc(1,e,r),a.push([r.x,r.y]);for(let e=4;e>=1;--e){let t=a[e];t!==void 0&&a.push([-t[0],t[1]])}for(let[n,r]of a)e.push(n,r,Y(1,r)+.01),t.push(n,r);for(let e=1;e<a.length;e+=1)n.push(0,e,e+1);return n.push(0,a.length,1),oc(e,t,n)}function gc(){let e=[],t=[],n=[];for(let n=0;n<=24;n+=1){let r=.02+n/24*.978,i=J.beam/2*J.halfBeamAt(r)*.985,a=ic(r);for(let n=0;n<=10;n+=1){let o=n/10*2-1,s=o*i,c=a+Ys*(1-o*o);e.push(s,c,Y(r,c)),t.push(s,r*J.length)}}for(let e=0;e<24;e+=1)for(let t=0;t<10;t+=1){let r=e*11+t;n.push(r,r+10+1,r+1,r+1,r+10+1,r+10+2)}return oc(e,t,n)}function _c(){let e=[],t=[],n=[],r=Hs,i=-.07;for(let a of[1,-1]){let o=e.length/3;for(let n=0;n<=r;n+=1){let o=n/r;for(let n of[i,.11]){let r=rc(o,n)+.012;e.push(a*r,n,Y(o,n)),t.push(a*(n-i),o*J.length)}}for(let e=0;e<r;e+=1){let t=o+e*2;a>0?n.push(t,t+1,t+2,t+1,t+3,t+2):n.push(t,t+2,t+1,t+1,t+2,t+3)}}return oc(e,t,n)}function vc(e,n,r,i,a){let o=[];for(let s=0;s<=r;s+=1){let c=e+(n-e)*s/r,l=J.sheerAt(c),u=J.beam/2*J.halfBeamAt(c);o.push(new t(a*u,l+i,Y(c,l)))}return o}function yc(e,n,r,i){let a=[],o=new x;for(let s=0;s<=r;s+=1){let c=e+(n-e)*s/r;tc(c,2,o),a.push(new t(i*o.x,o.y,Y(c,o.y)))}return a}function bc(){let e=[];for(let n=0;n<=24;n+=1){let r=.04+n/24*.94,i=J.keelAt(r);e.push(new t(0,i-.035,Y(r,i)))}return e}function xc(){let e=[],n=J.keelAt(0),r=J.sheerAt(0);for(let i=0;i<=12;i+=1){let a=n+(r-n)*i/12;e.push(new t(0,a,Y(0,a)-.03))}return e}function Sc(e,t,n){let r=new F(.028,.028,.26,10).rotateZ(Math.PI/2);r.translate(0,.11,0);let i=[r];for(let e of[-.07,.07]){let t=new F(.026,.032,.12,8);t.translate(e,.05,0),i.push(t)}let a=Me(i,!1);for(let e of i)e.dispose();return sc(a,.3,.3),a.translate(e,t,n)}var Cc={Planks023A:{repeat:.55,color:10069419,roughness:.95},WoodFloor043:{repeat:1.1,roughness:1},Wood066:{repeat:.85,color:13087385},Metal063:{repeat:1.4,roughness:1},Metal032:{repeat:2.2,roughness:.9},PaintedMetal006:{repeat:1.8,color:1778476},Rope001:{repeat:2.6},Fabric030:{repeat:1.6}};function wc(e,t){return new we({color:e,emissive:t,emissiveIntensity:0,roughness:.22,metalness:0,transparent:!0,opacity:.85})}async function Tc(n){let[i,a,o,s,l,u,d,f,p]=await Promise.all([n.load(`Planks023A`,Cc.Planks023A),n.load(`WoodFloor043`,Cc.WoodFloor043),n.load(`Wood066`,Cc.Wood066),n.load(`Metal063`,Cc.Metal063),n.load(`Metal032`,Cc.Metal032),n.load(`PaintedMetal006`,Cc.PaintedMetal006),n.load(`Rope001`,Cc.Rope001),n.load(`Fabric030`,Cc.Fabric030),n.load(`Fabric030`,{repeat:2.4})]);p.side=2;let m=new r;m.name=`boat`;let h=[],g=[],_=new Map,v=(e,t)=>{let n=_.get(e);n===void 0?_.set(e,[ac(t)]):n.push(ac(t))};v(i,mc()),v(i,hc()),v(s,lc(xc(),uc(.05,8))),v(s,lc(bc(),dc(.03,.05)));let y=J.keelAt(.92);v(s,new R(.07,.3,1.2).translate(0,y-.14,2.85));for(let e of[1,-1])v(s,lc(yc(.12,.99,20,e),uc(.035,6)));v(a,gc());for(let e of[1,-1])v(o,lc(vc(.03,.995,26,.03,e),dc(.055,.032)));let b=ic(.62),x=.85;v(o,cc(1.62,1.2,1.7).translate(0,b+.6,x)),v(o,cc(1.82,.08,1.9).translate(0,b+1.24,x));let S=[new R(1.24,.5,.04).translate(0,b+.82,-.010000000000000009),new R(.04,.42,.8).translate(.82,b+.8,x),new R(.04,.42,.8).translate(-.82,b+.8,x)],C=ac(Me(S,!1));for(let e of S)e.dispose();let w=new we({color:10467012,roughness:.05,metalness:0,transparent:!0,opacity:.3});g.push(w),h.push(C);let T=new e(C,w);T.receiveShadow=!0,m.add(T);let E=-.6,D=ic((E+Vs)/J.length),O=3.4;v(o,new F(.055,.085,O,10).translate(0,D+O/2,E));let ee=D+1.55;v(o,new F(.045,.05,2.1,8).rotateX(Math.PI/2).translate(0,ee,.45000000000000007));let k=new le;k.position.set(0,D+O,E),m.add(k);for(let e of[1,-1]){v(l,lc(vc(.09,.42,14,.52,e),uc(.022,7)));for(let t=0;t<=3;t+=1){let n=.09+t/3*.33,r=J.sheerAt(n),i=J.beam/2*J.halfBeamAt(n);v(l,new F(.019,.023,.52,7).translate(e*i,r+.26,Y(n,r)))}}let te=J.sheerAt(.055);v(l,Sc(0,te+.06,Y(.055,te)));for(let e of[1,-1])for(let t of[.4,.86]){let n=J.sheerAt(t);v(l,Sc(e*(J.beam/2)*J.halfBeamAt(t),n+.06,Y(t,n)))}let A=new le;A.position.set(.86,ic(.86)+.24,2.35),A.rotation.set(.42,0,-.38),A.updateMatrix(),m.add(A);let M=new F(.05,.05,.44,10).translate(0,.06,0);M.applyMatrix4(A.matrix),v(l,sc(M,.3,.3));let N=ee-.36,ne=1.35;v(l,new F(.075,.09,.1,8).translate(0,N+.16,ne)),v(l,new F(.012,.012,.3,6).translate(0,N+.32,ne)),v(f,sc(new c(.3,.07,8,22),2,.5).rotateY(Math.PI/2).translate(.87,b+.72,1.05)),v(o,cc(.52,.26,.34).translate(-.6,ic(.78)+.13,1.95)),v(o,cc(.55,.05,.37).translate(-.6,ic(.78)+.28,1.95));let P=ac(_c());h.push(P);let re=new e(P,u);re.name=`waterlineBand`,re.castShadow=!0,re.receiveShadow=!0,m.add(re);let ie=.3,ae=J.sheerAt(ie)+.09,oe=Y(ie,ae),se=J.beam/2*J.halfBeamAt(ie),ce=()=>new F(.05,.05,.11,10),ue=(t,n,r,i,a,o)=>{let s=wc(i,a);g.push(s);let c=ac(ce().translate(t,n,r));h.push(c);let u=new e(c,s);return m.add(u),o&&v(l,new F(.062,.07,.06,10).translate(t,n-.085,r)),{mesh:u,material:s}},de={port:ue(-se,ae,oe,3803142,16716808,!0),starboard:ue(se,ae,oe,207888,1244998,!0),stern:ue(0,J.sheerAt(.99)+.3,Y(.99,J.sheerAt(.99)),2763302,16773330,!0),masthead:ue(0,D+O-.14,E,2763302,16773852,!1),lantern:ue(0,N,ne,2827290,16760430,!1)},fe=.99,pe=J.sheerAt(fe),me=.45,he=Y(fe,pe);v(l,new F(.016,.02,.95,6).translate(me,pe+.44,he));let ge=.62,_e=.4,ve=new Se(ge,_e,14,7);ve.translate(ge/2,0,0),sc(ve,ge,_e),ac(ve),h.push(ve);let I=ve.getAttribute(`position`);if(!(I instanceof j))throw Error(`PlaneGeometry produced an interleaved position attribute`);let ye=new e(ve,p);ye.castShadow=!0,ye.frustumCulled=!1;let be=new le;be.position.set(me,pe+.66,he),be.add(ye),m.add(be);let xe={pivot:be,mesh:ye,positions:I,rest:new Float32Array(I.array),width:ge},Ce=J.sheerAt(.78)+.06,Te=J.beam/2*J.halfBeamAt(.78)*.9,Ee=Y(.78,Ce),L=J.sheerAt(.06)+.1,De=[pc(new t(0,D+O-.3,E),new t(-Te,Ce,Ee),.14,.022,d),pc(new t(-Te,Ce,2.5),new t(Te,Ce,2.5),.24,.018,d),pc(new t(0,ee-.05,1.35),new t(.55,b+1.3,x),.3,.02,d),pc(new t(0,L,Y(.06,L)),new t(.42,-.15,-2.2),.35,.026,d)];for(let e of De)h.push(e.mesh.geometry),m.add(e.root);for(let[t,n]of _){let r=Me(n,!1);for(let e of n)e.dispose();h.push(r);let i=new e(r,t);i.castShadow=!0,i.receiveShadow=!0,m.add(i)}return A.updateMatrix(),{group:m,mastTop:k,rodHolder:A,navLights:de,flag:xe,waterlineBand:re,ropes:De,rodTipOffset:new t(0,Zs,0).applyMatrix4(A.matrix),deckOffset:new t(0,ic(.72)+.06,1.7),materials:[i,a,o,s,l,u,d,f,p,...g],dispose(){for(let e of h)e.dispose();for(let e of g)e.dispose();h.length=0,g.length=0,m.clear()}}}var Ec=9.80665,Dc=1.943844,Oc=-.833,kc=6e3,Ac=.4,jc=120,Mc=1.6,Nc=4.6,Pc=1.05,Fc=1.225,Ic=11e3,Lc=42e3,Rc=26,zc=40,Bc=18,Vc=new t(0,-.34,3.1),Hc=new t(0,-.28,3.35),Uc=new t(0,1.15,.2),Wc=new t(0,.9,-3.3),Gc=-.18,Kc=.26,qc=.38,Jc=.3,Yc=.85,Xc=.75,Zc=7.5;function Qc(e,t,n){let r=0,i=0,a=0;for(let t of e)r+=t.area,i+=t.area*t.offset.x*t.offset.x,a+=t.area*t.offset.y*t.offset.y;let o=t*Ec;return{roll:o*(i/3+a/2),pitch:o*(r*n*n/12+a/2)}}function $c(e,t,n){let r=(2*t.x)**2,i=(2*t.y)**2,a=(2*t.z)**2;return n.set(e*(i+a)/12,e*(r+a)/12,e*(r+i)/12)}function el(e){let t=0,n=0;for(let r of e){let e=r.area*G(-r.offset.y,0,r.span);t+=e,n+=e*r.offset.z}return t===0?0:n/t}function tl(e,t,n,r,i){let a=0,o=0,s=0;for(let t of e){let{x:e,y:n,z:r}=t.offset;a+=t.area,o+=t.area*(e*e-n*n),s+=t.area*(r*r-n*n)}let c=t*Ec,l=-r.y*n*Ec;return{heave:c*a,roll:Math.max(1,c*o+l+i.roll),pitch:Math.max(1,c*s+l+i.pitch)}}function nl(){let e=Cs(Ss),n=Ts(e),r=Ss.sheerAt(.5)-Ss.keelAt(.5),i=new t(Ss.beam/2,r/2,Ss.length/2),a=new t(0,Gc,el(e)),o=Qc(e,bs,Ss.length/Math.max(1,e.length/2)),s=tl(e,bs,n,a,o),c=$c(n,i,new t);return{config:{mass:n,probes:e,halfExtents:i,waterDensity:bs,linearDamping:.05,angularDamping:400,dragArea:new t(4.6,15,1),dragCoefficient:.85},centreOfGravity:a,metacentricCorrection:o,radiationDamping:new t(n/Xc,2*Kc*Math.sqrt(s.heave*n),n/Zc),rotationalRadiationDamping:new t(2*Jc*Math.sqrt(s.pitch*c.x),c.y/Yc,2*qc*Math.sqrt(s.roll*c.z))}}var rl=new P,il=new t,al=new t,ol=new t,sl=new t,cl=new t,ll=new t;function ul(e,t){let n=e.wettedFraction;if(n>0){rl.copy(e.orientation).invert(),il.copy(e.velocity).applyQuaternion(rl);let r=t.radiationDamping;al.set(-il.x*r.x,-il.y*r.y,-il.z*r.z).multiplyScalar(n).applyQuaternion(e.orientation),e.addForce(al,null),il.copy(e.angularVelocity).applyQuaternion(rl);let i=t.rotationalRadiationDamping;al.set(-il.x*i.x,-il.y*i.y,-il.z*i.z).multiplyScalar(n).applyQuaternion(e.orientation),e.addTorque(al)}if(ol.copy(t.centreOfGravity).applyQuaternion(e.orientation),al.set(0,-t.config.mass*Ec,0),e.addTorque(sl.copy(ol).cross(al)),n<=0)return;cl.set(1,0,0).applyQuaternion(e.orientation),ll.set(0,0,1).applyQuaternion(e.orientation);let r=t.metacentricCorrection;e.addTorque(sl.copy(ll).multiplyScalar(-r.roll*cl.y*n)),e.addTorque(sl.copy(cl).multiplyScalar(r.pitch*ll.y*n))}var dl=new t,fl=new t,pl=new t,ml=new t,hl=new t,gl=class e{name=`boat`;priority=20;parts;solver;physics;water;sampleHeight;throttle=0;rudder=0;boost=0;anchored=!1;anchorPoint=new t;lightLevel=0;flagPhase=0;constructor(e,t,n){this.water=t,this.parts=n,this.physics=nl(),this.solver=new Bs(this.physics.config),this.sampleHeight=(e,t)=>this.water.heightAt(e,t),this.solver.position.set(0,t.heightAt(0,0),0),e.scene.add(n.group)}static async create(t,n,r){return new e(t,n,await Tc(r))}get position(){return this.solver.position}get velocity(){return this.solver.velocity}get orientation(){return this.solver.orientation}get speedKnots(){return Math.hypot(this.solver.velocity.x,this.solver.velocity.z)*Dc}get heading(){return hl.set(0,0,-1).applyQuaternion(this.solver.orientation),Math.atan2(hl.x,-hl.z)}get verticalAcceleration(){return this.solver.verticalAcceleration}get isAnchored(){return this.anchored}get throttleSetting(){return this.throttle}get materials(){return this.parts.materials}rodTipWorldPosition(e){return this.solver.localToWorld(this.parts.rodTipOffset,e)}deckPoint(e){return this.solver.localToWorld(this.parts.deckOffset,e)}fixedUpdate(e,t){let n=t.input;this.throttle=K(this.throttle,n.throttleAxis,1.8,e),this.rudder=K(this.rudder,n.rudderAxis,6,e),this.boost=K(this.boost,+!!n.isHeld(`boost`),3.5,e),ul(this.solver,this.physics),this.applyPropulsion(t),this.applyWindage(t),this.anchored&&this.applyGroundTackle(),this.solver.step(e,this.sampleHeight)}update(e,t){t.input.wasPressed(`anchor`)&&(this.anchored=!this.anchored,this.anchored&&this.anchorPoint.copy(this.solver.position)),this.parts.group.position.copy(this.solver.position),this.parts.group.quaternion.copy(this.solver.orientation),this.updateNavigationLights(e,t),this.updateCanvasAndCordage(e,t)}dispose(){this.parts.group.removeFromParent(),this.parts.dispose()}applyPropulsion(e){let t=this.solver,n=t.wettedFraction;if(n<=0)return;let r=e.world.beaufort,i=G(1-.035*r,.55,1),a=G(1-.05*r,.4,1),o=this.throttle>=0?1:Ac,s=kc*this.throttle*o*(1+.6499999999999999*this.boost)*i*n;hl.set(0,0,-1).applyQuaternion(t.orientation),t.addForce(dl.copy(hl).multiplyScalar(s),t.localToWorld(Vc,fl)),rl.copy(t.orientation).invert(),pl.copy(t.velocity).applyQuaternion(rl);let c=-pl.z+Mc*this.throttle,l=-this.rudder*jc*c*Math.abs(c)*a*n;dl.set(l,0,0).applyQuaternion(t.orientation),t.addForce(dl,t.localToWorld(Hc,fl))}applyWindage(e){let t=e.world,n=t.windX-this.solver.velocity.x,r=t.windZ-this.solver.velocity.z,i=Math.hypot(n,r);if(i<1e-4)return;let a=.5*Fc*Pc*Nc*i;dl.set(n*a,0,r*a),this.solver.addForce(dl,this.solver.localToWorld(Uc,fl))}applyGroundTackle(){let e=this.solver,t=e.position.x-this.anchorPoint.x,n=e.position.z-this.anchorPoint.z;dl.set(-5200*t-Ic*e.velocity.x,0,-5200*n-Ic*e.velocity.z);let r=dl.length();r>Lc&&dl.multiplyScalar(Lc/r),e.addForce(dl,e.localToWorld(Wc,fl))}updateNavigationLights(e,t){let n=t.world.ephemeris,r=n!==null&&n.sunAltitudeDeg<Oc;this.lightLevel=K(this.lightLevel,+!!r,3,e);let i=this.lightLevel/Math.max(1e-6,t.world.exposure),a=this.parts.navLights;a.port.material.emissiveIntensity=i*Rc,a.starboard.material.emissiveIntensity=i*Rc,a.stern.material.emissiveIntensity=i*Rc,a.masthead.material.emissiveIntensity=i*zc,a.lantern.material.emissiveIntensity=i*Bc}updateCanvasAndCordage(e,t){let n=t.world,r=n.windX-this.solver.velocity.x,i=n.windZ-this.solver.velocity.z,a=Math.hypot(r,i);rl.copy(this.solver.orientation).invert(),ml.set(r,0,i).applyQuaternion(rl),this.flagPhase+=e*(2.4+a*.85);let o=this.parts.flag;a>.001&&(o.pivot.rotation.y=Math.atan2(-ml.z,ml.x));let s=G(.015+a*.02,.015,.15),c=G(.26-a*.035,0,.26),l=o.rest,u=o.positions;for(let e=0;e<u.count;e+=1){let t=l[e*3]??0,n=l[e*3+1]??0,r=t/o.width,i=Math.sin(9.5*t-this.flagPhase*4.2+n*3.1);u.setXYZ(e,t,n-c*r*r,s*r*r*i)}u.needsUpdate=!0,o.mesh.geometry.computeVertexNormals();for(let e=0;e<this.parts.ropes.length;e+=1){let t=this.parts.ropes[e];if(t===void 0)continue;let n=t.root.rotation.y,r=ml.x*Math.sin(n)+ml.z*Math.cos(n),i=Math.sin(this.flagPhase*1.7+e*2.1)*.18*a;t.pivot.quaternion.setFromAxisAngle(t.axis,G(t.response*(r+i),-1.3,1.3))}}},_l=4.6,vl=1.9,yl=6.5,bl=4.2,xl=2.6,Sl=.32,Cl=.75,wl=.22,Tl=.55,El=-2.5,Dl=6,Ol=5,kl=11,Al=.011,jl=3.4,Ml=27.3,Nl=19.7,Pl=.85,Fl=1.15,Il=.0026,Ll=4,Rl=60,zl=new t(0,1,0),Bl=new t(0,0,1),Vl=new t,Hl=new t,Ul=new t,Wl=new t,Gl=new t,Kl=new P,ql=new b,Jl=[`follow`,`firstPerson`,`orbit`];function Yl(e,t,n,r){let i=(t-e)%(Math.PI*2);return i>Math.PI&&(i-=Math.PI*2),i<=-Math.PI&&(i+=Math.PI*2),K(e,e+i,n,r)}function Xl(e,t,n,r){e.set(K(e.x,t.x,n,r),K(e.y,t.y,n,r),K(e.z,t.z,n,r))}var Zl=class{name=`boatCamera`;priority=30;boat;water;baseFov;modeIndex=0;rig=new t;eye=new t;target=new t;attitude=new P;chaseHeading=0;fov;shake=0;shakePhase=0;previousSurgeSpeed=0;lookYaw=0;lookPitch=-.05;orbitDistance=14;constructor(e,t,n){this.boat=t,this.water=n,this.baseFov=e.camera.fov,this.fov=this.baseFov,this.chaseHeading=t.heading,t.deckPoint(this.target),this.target.y+=vl,Ul.set(Math.sin(this.chaseHeading),0,-Math.cos(this.chaseHeading)),this.rig.copy(t.position).addScaledVector(Ul,-11.5),this.rig.y=t.position.y+_l,this.eye.copy(this.rig),e.camera.position.copy(this.eye)}get mode(){return Jl[this.modeIndex]??`follow`}update(e,t){let n=t.input;switch(n.wasPressed(`cameraMode`)&&(this.modeIndex=(this.modeIndex+1)%Jl.length),this.accumulateShake(e,t.world.significantWaveHeight,t.world.beaufort),this.updateFieldOfView(e),this.mode){case`firstPerson`:this.driveFirstPerson(n);break;case`orbit`:this.driveOrbit(e,n);break;default:this.driveFollow(e)}this.applyShake(),this.floatClearOfCrest(t.world.significantWaveHeight),t.camera.position.copy(this.eye),t.camera.quaternion.copy(this.attitude),Math.abs(t.camera.fov-this.fov)>.01&&(t.camera.fov=this.fov,t.camera.updateProjectionMatrix())}accumulateShake(e,t,n){let r=Math.abs(this.boat.verticalAcceleration)-kl;if(r>0){let e=1+t*.4+n*.06;this.shake=Math.min(Pl,Math.max(this.shake,r*Al*e))}this.shake=K(this.shake,0,jl,e),this.shakePhase+=e}updateFieldOfView(e){let t=Math.hypot(this.boat.velocity.x,this.boat.velocity.z),n=e>1e-6?(t-this.previousSurgeSpeed)/e:0;this.previousSurgeSpeed=t;let r=G(n*Tl,El,Dl),i=this.mode===`firstPerson`?.5:1;this.fov=K(this.fov,this.baseFov+r*i,Ol,e)}driveFollow(e){this.chaseHeading=Yl(this.chaseHeading,this.boat.heading,xl,e),Ul.set(Math.sin(this.chaseHeading),0,-Math.cos(this.chaseHeading)),Vl.copy(this.boat.position).addScaledVector(Ul,-11.5).addScaledVector(this.boat.velocity,-.35),Vl.y=this.boat.position.y+_l,Xl(this.rig,Vl,yl,e),Xl(this.eye,this.rig,bl,e),this.boat.deckPoint(Hl),Hl.y+=vl,Xl(this.target,Hl,yl,e),this.aimAt(this.target,this.hullHeel()*Sl)}driveFirstPerson(e){this.readLook(e),this.boat.deckPoint(this.eye),Wl.set(0,1,0).applyQuaternion(this.boat.orientation),this.eye.addScaledVector(Wl,Fl),this.rig.copy(this.eye),this.attitude.copy(this.boat.orientation),Kl.setFromAxisAngle(zl,this.lookYaw),this.attitude.multiply(Kl),Kl.setFromAxisAngle(Wl.set(1,0,0),this.lookPitch),this.attitude.multiply(Kl),this.boat.deckPoint(this.target)}driveOrbit(e,t){(t.primaryDown||t.pointerLocked)&&this.readLook(t),this.orbitDistance=G(this.orbitDistance*(1+t.wheel*.0012),Ll,Rl),this.boat.deckPoint(Hl),Hl.y+=.8,Xl(this.target,Hl,yl,e);let n=G(this.lookPitch,-1.2,.35),r=Math.cos(n)*this.orbitDistance;Vl.set(this.target.x+Math.sin(this.lookYaw)*r,this.target.y-Math.sin(n)*this.orbitDistance,this.target.z+Math.cos(this.lookYaw)*r),Xl(this.rig,Vl,yl,e),Xl(this.eye,this.rig,bl,e),this.aimAt(this.target,0)}readLook(e){this.lookYaw-=e.pointerDeltaX*Il,this.lookPitch=G(this.lookPitch-e.pointerDeltaY*Il,-1.25,1.25)}hullHeel(){return Wl.set(1,0,0).applyQuaternion(this.boat.orientation),Math.asin(G(Wl.y,-1,1))}aimAt(e,t){ql.lookAt(this.eye,e,zl),this.attitude.setFromRotationMatrix(ql),Kl.setFromAxisAngle(Bl,t),this.attitude.multiply(Kl)}floatClearOfCrest(e){let t=Cl+wl*e,n=this.water.heightAt(this.eye.x,this.eye.z)+t;this.eye.y<n&&(this.eye.y=n,this.rig.y<n&&(this.rig.y=n))}applyShake(){if(this.shake<=1e-4)return;let e=Math.sin(this.shakePhase*Ml)*this.shake,t=Math.sin(this.shakePhase*Nl+1.7)*this.shake*.8;Gl.set(e,t,0).applyQuaternion(this.attitude),this.eye.add(Gl),Kl.setFromAxisAngle(Bl,e*.35),this.attitude.multiply(Kl)}},Ql=`precision highp float;

#ifndef ENDLESS_FISHING_CONSTANTS\r
#define ENDLESS_FISHING_CONSTANTS

const float PI = 3.14159265358979323846;\r
const float TWO_PI = 6.28318530717958647692;\r
const float HALF_PI = 1.57079632679489661923;\r
const float INV_PI = 0.31830988618379067154;\r
const float INV_FOUR_PI = 0.07957747154594766788;\r
const float DEG_TO_RAD = 0.01745329251994329577;\r
const float RAD_TO_DEG = 57.2957795130823208768;

const float EPS = 1e-6;

#ifndef saturate\r
float saturate(float x) { return clamp(x, 0.0, 1.0); }\r
vec2 saturate(vec2 x) { return clamp(x, 0.0, 1.0); }\r
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }\r
#endif

float ef_luminance(vec3 colour) {\r
  return dot(colour, vec3(0.2126, 0.7152, 0.0722));\r
}

float remap(float x, float lowIn, float highIn, float lowOut, float highOut) {\r
  float span = highIn - lowIn;\r
  float t = span == 0.0 ? step(lowIn, x) : (x - lowIn) / span;\r
  return lowOut + saturate(t) * (highOut - lowOut);\r
}

vec3 hdrClamp(vec3 colour) {\r
  vec3 safe;\r
  safe.x = colour.x == colour.x ? colour.x : 0.0;\r
  safe.y = colour.y == colour.y ? colour.y : 0.0;\r
  safe.z = colour.z == colour.z ? colour.z : 0.0;\r
  
  
  return clamp(safe, vec3(0.0), vec3(60000.0));\r
}

float hdrClampAlpha(float alpha) {\r
  return clamp(alpha == alpha ? alpha : 0.0, 0.0, 1.0);\r
}

#endif
#ifndef ENDLESS_FISHING_GERSTNER
#define ENDLESS_FISHING_GERSTNER

#ifndef MAX_WAVES
#define MAX_WAVES 8
#endif

uniform vec4 uWaveA[MAX_WAVES];
uniform vec4 uWaveB[MAX_WAVES];
uniform int uWaveCount;
uniform float uWaveTime;

vec3 gerstnerDisplacement(vec2 undisplaced) {
  vec3 displacement = vec3(0.0);

  for (int i = 0; i < MAX_WAVES; i++) {
    if (i >= uWaveCount) break;

    vec2 direction = uWaveA[i].xy;
    float amplitude = uWaveA[i].z;
    float wavenumber = uWaveA[i].w;
    float frequency = uWaveB[i].x;
    float phase = uWaveB[i].y;
    float steepness = uWaveB[i].z;

    float theta = wavenumber * dot(direction, undisplaced) - frequency * uWaveTime + phase;
    float cosTheta = cos(theta);
    float sinTheta = sin(theta);
    float pinch = steepness * amplitude;

    displacement.x += pinch * direction.x * cosTheta;
    displacement.y += amplitude * sinTheta;
    displacement.z += pinch * direction.y * cosTheta;
  }

  return displacement;
}

void gerstnerSurface(vec2 undisplaced, out vec3 normal, out float jacobian) {
  
  vec3 tangentX = vec3(1.0, 0.0, 0.0);
  vec3 tangentZ = vec3(0.0, 0.0, 1.0);

  for (int i = 0; i < MAX_WAVES; i++) {
    if (i >= uWaveCount) break;

    vec2 direction = uWaveA[i].xy;
    float amplitude = uWaveA[i].z;
    float wavenumber = uWaveA[i].w;
    float frequency = uWaveB[i].x;
    float phase = uWaveB[i].y;
    float steepness = uWaveB[i].z;

    float theta = wavenumber * dot(direction, undisplaced) - frequency * uWaveTime + phase;
    float cosTheta = cos(theta);
    float sinTheta = sin(theta);

    float pinch = steepness * amplitude * wavenumber;
    float slope = amplitude * wavenumber;

    tangentX.x -= pinch * direction.x * direction.x * sinTheta;
    tangentX.z -= pinch * direction.x * direction.y * sinTheta;
    tangentX.y += slope * direction.x * cosTheta;

    tangentZ.x -= pinch * direction.y * direction.x * sinTheta;
    tangentZ.z -= pinch * direction.y * direction.y * sinTheta;
    tangentZ.y += slope * direction.y * cosTheta;
  }

  normal = normalize(cross(tangentZ, tangentX));
  
  
  jacobian = tangentX.x * tangentZ.z - tangentX.z * tangentZ.x;
}

#endif

attribute vec4 aTrackA;
attribute vec3 aTrackB;

uniform float uWaterLevel;

uniform float uTime;

uniform float uTrackLength;
uniform float uLifetime;

uniform float uHalfBeam;

uniform float uAmplitude;

uniform float uLift;

uniform float uSampleSpacing;
uniform float uLateralCells;

uniform float uMaxBehind;

uniform float uValidRows;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUndisplaced;
varying float vFoam;
varying float vFade;

const float GRAVITY = 9.80665;

const float EARTH_RADIUS_M = 6371000.0;

const float KELVIN_TAN = 0.3535533906;

const int WAKE_TERMS = 5;
const float MAX_THETA = 1.047197551;

void main() {
  float lateral = position.x;
  float row = position.z;

  float age = max(0.0, uTime - aTrackA.z);
  float behind = clamp(uTrackLength - aTrackA.w, 0.0, uMaxBehind);
  float speed = aTrackB.z;

  
  
  float ageFade = 1.0 - smoothstep(uLifetime * 0.3, uLifetime, age);
  
  
  
  
  
  
  
  
  
  
  
  float validEnd = max(uValidRows, 1e-4);
  float tailFade = step(1e-4, uValidRows) * (1.0 - smoothstep(validEnd * 0.86, validEnd, row));
  
  
  
  float drive = smoothstep(0.3, 1.5, speed) * ((speed * speed) / (speed * speed + 9.0));
  
  
  float edgeFade = 1.0 - smoothstep(0.86, 1.0, abs(lateral));

  float envelope = ageFade * tailFade * edgeFade;

  
  float halfWidth = uHalfBeam + KELVIN_TAN * behind;
  vec2 along = aTrackB.xy;
  vec2 across = vec2(along.y, -along.x);
  float offset = lateral * halfWidth;
  vec2 undisplaced = aTrackA.xy + across * offset;

  float wavenumber = GRAVITY / max(0.25, speed * speed);
  float acrossStep = max(0.05, (2.0 * halfWidth) / uLateralCells);
  float distanceAcross = abs(offset);

  float elevation = 0.0;
  float slopeAlong = 0.0;
  float slopeAcross = 0.0;
  float weightSum = 0.0;

  for (int term = 0; term < WAKE_TERMS; term++) {
    float theta = (float(term) / float(WAKE_TERMS - 1)) * MAX_THETA;
    float cosTheta = cos(theta);
    float sinTheta = sin(theta);
    float k = wavenumber / (cosTheta * cosTheta);
    float kAlong = k * cosTheta;
    float kAcross = k * sinTheta;

    
    
    
    
    
    
    float resolvable =
        (1.0 - smoothstep(PI / (2.0 * uSampleSpacing), PI / uSampleSpacing, kAlong)) *
        (1.0 - smoothstep(PI / (2.0 * acrossStep), PI / acrossStep, kAcross));

    float weight = cosTheta * cosTheta;
    float phase = kAlong * behind + kAcross * distanceAcross;
    float carried = weight * resolvable;

    elevation += carried * cos(phase);
    slopeAlong -= carried * kAlong * sin(phase);
    slopeAcross -= carried * kAcross * sin(phase) * sign(offset);
    weightSum += weight;
  }

  float normalise = 1.0 / max(EPS, weightSum);
  
  
  
  float amplitude = uAmplitude * drive * envelope * smoothstep(0.0, 2.0, behind)
      * inversesqrt(1.0 + behind * 0.12) * normalise;

  elevation *= amplitude;
  slopeAlong *= amplitude;
  slopeAcross *= amplitude;

  
  
  
  
  
  
  vec3 sea = gerstnerDisplacement(undisplaced);
  vec3 seaNormal;
  float jacobian;
  gerstnerSurface(undisplaced, seaNormal, jacobian);

  
  
  
  
  
  
  
  
  vec3 world = vec3(
      undisplaced.x + sea.x,
      uWaterLevel + sea.y + max(elevation, 0.0) + uLift,
      undisplaced.y + sea.z);

  
  
  vec2 gradient = slopeAlong * (-along) + slopeAcross * across;
  vNormal = normalize(vec3(
      seaNormal.x - gradient.x * seaNormal.y,
      seaNormal.y,
      seaNormal.z - gradient.y * seaNormal.y));

  
  
  
  
  
  
  
  
  float emerging = smoothstep(0.0, 1.4, behind);
  
  
  
  float race = emerging * (1.0 - smoothstep(0.8, 8.0, behind))
      * (1.0 - smoothstep(uHalfBeam * 0.3, uHalfBeam * 1.15, distanceAcross));
  
  
  float cusp = emerging * smoothstep(0.62, 0.99, abs(lateral)) * (1.0 - smoothstep(4.0, 55.0, behind));
  vFoam = clamp(race * 0.8 + cusp * 0.85, 0.0, 1.0) * drive * envelope;

  vWorldPosition = world;
  vUndisplaced = undisplaced;
  vFade = envelope * drive;

  
  
  
  
  
  float horizontal = distance(world.xz, cameraPosition.xz);
  vec3 projected = vec3(world.x, world.y - (horizontal * horizontal) / (2.0 * EARTH_RADIUS_M), world.z);

  gl_Position = projectionMatrix * viewMatrix * vec4(projected, 1.0);
}`,$l=`precision highp float;

#ifndef ENDLESS_FISHING_WORLDLIGHT\r
#define ENDLESS_FISHING_WORLDLIGHT

#ifndef ENDLESS_FISHING_CONSTANTS\r
#define ENDLESS_FISHING_CONSTANTS

const float PI = 3.14159265358979323846;\r
const float TWO_PI = 6.28318530717958647692;\r
const float HALF_PI = 1.57079632679489661923;\r
const float INV_PI = 0.31830988618379067154;\r
const float INV_FOUR_PI = 0.07957747154594766788;\r
const float DEG_TO_RAD = 0.01745329251994329577;\r
const float RAD_TO_DEG = 57.2957795130823208768;

const float EPS = 1e-6;

#ifndef saturate\r
float saturate(float x) { return clamp(x, 0.0, 1.0); }\r
vec2 saturate(vec2 x) { return clamp(x, 0.0, 1.0); }\r
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }\r
#endif

float ef_luminance(vec3 colour) {\r
  return dot(colour, vec3(0.2126, 0.7152, 0.0722));\r
}

float remap(float x, float lowIn, float highIn, float lowOut, float highOut) {\r
  float span = highIn - lowIn;\r
  float t = span == 0.0 ? step(lowIn, x) : (x - lowIn) / span;\r
  return lowOut + saturate(t) * (highOut - lowOut);\r
}

vec3 hdrClamp(vec3 colour) {\r
  vec3 safe;\r
  safe.x = colour.x == colour.x ? colour.x : 0.0;\r
  safe.y = colour.y == colour.y ? colour.y : 0.0;\r
  safe.z = colour.z == colour.z ? colour.z : 0.0;\r
  
  
  return clamp(safe, vec3(0.0), vec3(60000.0));\r
}

float hdrClampAlpha(float alpha) {\r
  return clamp(alpha == alpha ? alpha : 0.0, 0.0, 1.0);\r
}

#endif\r
#ifndef ENDLESS_FISHING_AIRLIGHT\r
#define ENDLESS_FISHING_AIRLIGHT

vec3 ef_airLight(samplerCube environment, float intensity, vec3 V) {\r
  vec3 direction = normalize(vec3(-V.x, max(-V.y, 0.07), -V.z) + vec3(EPS, 0.0, 0.0));\r
  return textureCubeLodEXT(environment, direction, 1.0).rgb * intensity;\r
}

#endif

uniform vec3 uSunDirection;\r
uniform vec3 uSunColour;

uniform float uSunIlluminance;\r
uniform vec3 uMoonDirection;\r
uniform vec3 uMoonColour;\r
uniform float uMoonIlluminance;

uniform samplerCube uEnvironment;\r
uniform float uEnvironmentIntensity;

uniform float uVisibility;

float ef_ggx(float nDotH, float roughness) {\r
  float a = roughness * roughness;\r
  float a2 = a * a;\r
  float d = nDotH * nDotH * (a2 - 1.0) + 1.0;\r
  return a2 / max(EPS, PI * d * d);\r
}

float ef_smith(float nDotV, float nDotL, float roughness) {\r
  float k = roughness * roughness * 0.5;\r
  return (nDotV / (nDotV * (1.0 - k) + k)) * (nDotL / (nDotL * (1.0 - k) + k));\r
}

vec3 ef_fresnel(float cosTheta, vec3 f0) {\r
  float m = clamp(1.0 - cosTheta, 0.0, 1.0);\r
  float m2 = m * m;\r
  return f0 + (1.0 - f0) * m2 * m2 * m;\r
}

vec3 ef_directLight(\r
    vec3 L, vec3 colour, float illuminance,\r
    vec3 N, vec3 V, vec3 albedo, vec3 f0, float roughness) {\r
  if (illuminance <= 0.0) return vec3(0.0);

  float nDotL = dot(N, L);\r
  if (nDotL <= 0.0) return vec3(0.0);

  float horizon = smoothstep(-0.035, 0.02, L.y);\r
  if (horizon <= 0.0) return vec3(0.0);

  float nDotV = max(1e-3, dot(N, V));\r
  vec3 H = normalize(L + V);\r
  float nDotH = max(0.0, dot(N, H));

  float D = ef_ggx(nDotH, roughness);\r
  float G = ef_smith(nDotV, nDotL, roughness);\r
  vec3 F = ef_fresnel(max(0.0, dot(H, V)), f0);\r
  vec3 specular = (D * G / (4.0 * nDotV * nDotL + EPS)) * F;

  return colour * illuminance * nDotL * horizon * (albedo * INV_PI * (1.0 - F) + specular);\r
}

vec3 ef_shadeSurface(vec3 albedo, vec3 N, vec3 V, float roughness, float occlusion, vec3 f0) {\r
  vec3 colour = vec3(0.0);\r
  colour += ef_directLight(uSunDirection, uSunColour, uSunIlluminance, N, V, albedo, f0, roughness);\r
  colour += ef_directLight(uMoonDirection, uMoonColour, uMoonIlluminance, N, V, albedo, f0, roughness);

  
  
  
  vec3 irradiance = textureCubeLodEXT(uEnvironment, N, 6.0).rgb * uEnvironmentIntensity;\r
  vec3 R = reflect(-V, N);\r
  vec3 reflection = textureCubeLodEXT(uEnvironment, R, roughness * 7.0).rgb * uEnvironmentIntensity;

  float nDotV = max(1e-3, dot(N, V));\r
  vec3 F = ef_fresnel(nDotV, f0);\r
  colour += albedo * irradiance * occlusion;\r
  colour += reflection * F * occlusion;

  return colour;\r
}

vec3 ef_aerialPerspective(vec3 colour, float distanceToCamera, vec3 V) {\r
  float extinction = 3.912 / max(200.0, uVisibility);\r
  float t = 1.0 - exp(-extinction * distanceToCamera);\r
  return mix(colour, ef_airLight(uEnvironment, uEnvironmentIntensity, V), t);\r
}

#endif

varying vec3 vWorldPosition;\r
varying vec3 vNormal;\r
varying vec2 vUndisplaced;\r
varying float vFoam;\r
varying float vFade;

uniform sampler2D uFoam;\r

const float WATER_F0 = 0.0203;

void main() {\r
  
  
  if (vFade <= 0.002) discard;

  vec3 viewVector = cameraPosition - vWorldPosition;\r
  float viewDistance = length(viewVector);\r
  vec3 V = viewVector / max(EPS, viewDistance);\r
  vec3 N = normalize(vNormal);

  vec4 foamSample = texture2D(uFoam, vUndisplaced * 0.09);\r
  float breakup = foamSample.r * (0.55 + 0.45 * foamSample.b);\r
  float coverage = clamp(vFoam * (0.35 + breakup), 0.0, 1.0);\r
  
  
  coverage *= smoothstep(0.0, 0.35, coverage + foamSample.g * 0.35 - 0.18);

  vec3 skyAbove = textureCubeLodEXT(uEnvironment, vec3(0.0, 1.0, 0.0), 5.0).rgb * uEnvironmentIntensity;\r
  vec3 sunlight = uSunColour * uSunIlluminance + uMoonColour * uMoonIlluminance;\r
  
  
  vec3 foamColour = (skyAbove * 0.42 + sunlight * 0.16 * max(0.0, dot(N, uSunDirection)))\r
      * vec3(0.94, 0.96, 0.97);

  
  
  float nDotV = max(1e-3, dot(N, V));\r
  vec3 specular = vec3(0.0);\r
  for (int light = 0; light < 2; light++) {\r
    vec3 L = light == 0 ? uSunDirection : uMoonDirection;\r
    vec3 colour = light == 0 ? uSunColour : uMoonColour;\r
    float illuminance = light == 0 ? uSunIlluminance : uMoonIlluminance;\r
    if (illuminance <= 0.0 || L.y <= -0.02) continue;

    
    
    float roughness = mix(0.075, 0.55, coverage);\r
    vec3 H = normalize(L + V);\r
    float nDotL = max(1e-3, dot(N, L));\r
    float D = ef_ggx(max(0.0, dot(N, H)), roughness);\r
    float G = ef_smith(nDotV, nDotL, roughness);\r
    vec3 F = ef_fresnel(max(0.0, dot(H, V)), vec3(WATER_F0));\r
    specular += (D * G / (4.0 * nDotV * nDotL + EPS)) * F * colour * illuminance * nDotL;\r
  }

  
  
  float alpha = hdrClampAlpha(coverage);\r
  vec3 lit = ef_aerialPerspective(foamColour + specular * vFade * 0.6, viewDistance, V);\r
  gl_FragColor = vec4(hdrClamp(lit * alpha), hdrClampAlpha(alpha));\r
}`,eu=`precision highp float;

#ifndef ENDLESS_FISHING_CONSTANTS\r
#define ENDLESS_FISHING_CONSTANTS

const float PI = 3.14159265358979323846;\r
const float TWO_PI = 6.28318530717958647692;\r
const float HALF_PI = 1.57079632679489661923;\r
const float INV_PI = 0.31830988618379067154;\r
const float INV_FOUR_PI = 0.07957747154594766788;\r
const float DEG_TO_RAD = 0.01745329251994329577;\r
const float RAD_TO_DEG = 57.2957795130823208768;

const float EPS = 1e-6;

#ifndef saturate\r
float saturate(float x) { return clamp(x, 0.0, 1.0); }\r
vec2 saturate(vec2 x) { return clamp(x, 0.0, 1.0); }\r
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }\r
#endif

float ef_luminance(vec3 colour) {\r
  return dot(colour, vec3(0.2126, 0.7152, 0.0722));\r
}

float remap(float x, float lowIn, float highIn, float lowOut, float highOut) {\r
  float span = highIn - lowIn;\r
  float t = span == 0.0 ? step(lowIn, x) : (x - lowIn) / span;\r
  return lowOut + saturate(t) * (highOut - lowOut);\r
}

vec3 hdrClamp(vec3 colour) {\r
  vec3 safe;\r
  safe.x = colour.x == colour.x ? colour.x : 0.0;\r
  safe.y = colour.y == colour.y ? colour.y : 0.0;\r
  safe.z = colour.z == colour.z ? colour.z : 0.0;\r
  
  
  return clamp(safe, vec3(0.0), vec3(60000.0));\r
}

float hdrClampAlpha(float alpha) {\r
  return clamp(alpha == alpha ? alpha : 0.0, 0.0, 1.0);\r
}

#endif
#ifndef ENDLESS_FISHING_GERSTNER
#define ENDLESS_FISHING_GERSTNER

#ifndef MAX_WAVES
#define MAX_WAVES 8
#endif

uniform vec4 uWaveA[MAX_WAVES];
uniform vec4 uWaveB[MAX_WAVES];
uniform int uWaveCount;
uniform float uWaveTime;

vec3 gerstnerDisplacement(vec2 undisplaced) {
  vec3 displacement = vec3(0.0);

  for (int i = 0; i < MAX_WAVES; i++) {
    if (i >= uWaveCount) break;

    vec2 direction = uWaveA[i].xy;
    float amplitude = uWaveA[i].z;
    float wavenumber = uWaveA[i].w;
    float frequency = uWaveB[i].x;
    float phase = uWaveB[i].y;
    float steepness = uWaveB[i].z;

    float theta = wavenumber * dot(direction, undisplaced) - frequency * uWaveTime + phase;
    float cosTheta = cos(theta);
    float sinTheta = sin(theta);
    float pinch = steepness * amplitude;

    displacement.x += pinch * direction.x * cosTheta;
    displacement.y += amplitude * sinTheta;
    displacement.z += pinch * direction.y * cosTheta;
  }

  return displacement;
}

void gerstnerSurface(vec2 undisplaced, out vec3 normal, out float jacobian) {
  
  vec3 tangentX = vec3(1.0, 0.0, 0.0);
  vec3 tangentZ = vec3(0.0, 0.0, 1.0);

  for (int i = 0; i < MAX_WAVES; i++) {
    if (i >= uWaveCount) break;

    vec2 direction = uWaveA[i].xy;
    float amplitude = uWaveA[i].z;
    float wavenumber = uWaveA[i].w;
    float frequency = uWaveB[i].x;
    float phase = uWaveB[i].y;
    float steepness = uWaveB[i].z;

    float theta = wavenumber * dot(direction, undisplaced) - frequency * uWaveTime + phase;
    float cosTheta = cos(theta);
    float sinTheta = sin(theta);

    float pinch = steepness * amplitude * wavenumber;
    float slope = amplitude * wavenumber;

    tangentX.x -= pinch * direction.x * direction.x * sinTheta;
    tangentX.z -= pinch * direction.x * direction.y * sinTheta;
    tangentX.y += slope * direction.x * cosTheta;

    tangentZ.x -= pinch * direction.y * direction.x * sinTheta;
    tangentZ.z -= pinch * direction.y * direction.y * sinTheta;
    tangentZ.y += slope * direction.y * cosTheta;
  }

  normal = normalize(cross(tangentZ, tangentX));
  
  
  jacobian = tangentX.x * tangentZ.z - tangentX.z * tangentZ.x;
}

#endif

attribute vec4 aSeed;

attribute float aSlot;

uniform float uTime;
uniform float uCycle;

uniform vec3 uEmitter;
uniform vec3 uEmitterRight;
uniform vec3 uEmitterForward;
uniform vec3 uEmitterVelocity;

uniform vec3 uWind;

uniform float uEmission;

uniform float uThrow;

uniform float uSize;
uniform float uWaterLevel;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vQuad;
varying float vAlpha;
varying float vViewDistance;

const float GRAVITY = 9.80665;

const float EARTH_RADIUS_M = 6371000.0;

void main() {
  vQuad = position.xy * 2.0;
  vAlpha = 0.0;
  vNormal = vec3(0.0, 1.0, 0.0);
  vWorldPosition = uEmitter;
  vViewDistance = 1.0;

  
  
  if (aSlot >= uEmission) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  float divisions = floor(mix(12.0, 26.0, aSeed.x));
  float life = uCycle / divisions;
  float age = mod(uTime + aSeed.y * uCycle, life);
  float age01 = age / life;

  
  
  
  float side = aSeed.z < 0.5 ? -1.0 : 1.0;
  float spread = 0.35 + 0.85 * fract(aSeed.z * 17.0);
  vec3 launch = normalize(
      uEmitterRight * (side * spread) +
      vec3(0.0, 0.55 + 0.95 * aSeed.w, 0.0) +
      uEmitterForward * (0.1 + 0.5 * fract(aSeed.x * 7.0)));

  
  
  vec3 velocity = launch * uThrow * (0.6 + 0.7 * aSeed.w) + uEmitterVelocity * 0.35;
  vec3 centre = uEmitter - uEmitterVelocity * age + velocity * age + uWind * (age * 0.35);
  centre.y -= 0.5 * GRAVITY * age * age;

  
  
  
  float surface = uWaterLevel + gerstnerDisplacement(centre.xz).y;
  
  
  float alive = smoothstep(surface - 0.05, surface + 0.3, centre.y);
  float fade = smoothstep(0.0, 0.18, age01) * (1.0 - smoothstep(0.5, 1.0, age01));
  
  
  float gate = 1.0 - smoothstep(uEmission - 0.1, uEmission, aSlot);

  vAlpha = fade * alive * gate;

  
  
  float size = uSize * (0.55 + 0.8 * aSeed.x) * (0.4 + 1.1 * age01) * (0.35 + 0.65 * gate);

  
  
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 toEye = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
  vec3 offset = right * position.x + up * position.y;
  vec3 world = centre + offset * size;

  vWorldPosition = world;
  
  
  vNormal = normalize(toEye + offset * 1.6);
  vViewDistance = distance(world, cameraPosition);

  
  
  float horizontal = distance(world.xz, cameraPosition.xz);
  vec3 projected = vec3(world.x, world.y - (horizontal * horizontal) / (2.0 * EARTH_RADIUS_M), world.z);

  gl_Position = projectionMatrix * viewMatrix * vec4(projected, 1.0);
}`,tu=`precision highp float;

#ifndef ENDLESS_FISHING_WORLDLIGHT\r
#define ENDLESS_FISHING_WORLDLIGHT

#ifndef ENDLESS_FISHING_CONSTANTS\r
#define ENDLESS_FISHING_CONSTANTS

const float PI = 3.14159265358979323846;\r
const float TWO_PI = 6.28318530717958647692;\r
const float HALF_PI = 1.57079632679489661923;\r
const float INV_PI = 0.31830988618379067154;\r
const float INV_FOUR_PI = 0.07957747154594766788;\r
const float DEG_TO_RAD = 0.01745329251994329577;\r
const float RAD_TO_DEG = 57.2957795130823208768;

const float EPS = 1e-6;

#ifndef saturate\r
float saturate(float x) { return clamp(x, 0.0, 1.0); }\r
vec2 saturate(vec2 x) { return clamp(x, 0.0, 1.0); }\r
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }\r
#endif

float ef_luminance(vec3 colour) {\r
  return dot(colour, vec3(0.2126, 0.7152, 0.0722));\r
}

float remap(float x, float lowIn, float highIn, float lowOut, float highOut) {\r
  float span = highIn - lowIn;\r
  float t = span == 0.0 ? step(lowIn, x) : (x - lowIn) / span;\r
  return lowOut + saturate(t) * (highOut - lowOut);\r
}

vec3 hdrClamp(vec3 colour) {\r
  vec3 safe;\r
  safe.x = colour.x == colour.x ? colour.x : 0.0;\r
  safe.y = colour.y == colour.y ? colour.y : 0.0;\r
  safe.z = colour.z == colour.z ? colour.z : 0.0;\r
  
  
  return clamp(safe, vec3(0.0), vec3(60000.0));\r
}

float hdrClampAlpha(float alpha) {\r
  return clamp(alpha == alpha ? alpha : 0.0, 0.0, 1.0);\r
}

#endif\r
#ifndef ENDLESS_FISHING_AIRLIGHT\r
#define ENDLESS_FISHING_AIRLIGHT

vec3 ef_airLight(samplerCube environment, float intensity, vec3 V) {\r
  vec3 direction = normalize(vec3(-V.x, max(-V.y, 0.07), -V.z) + vec3(EPS, 0.0, 0.0));\r
  return textureCubeLodEXT(environment, direction, 1.0).rgb * intensity;\r
}

#endif

uniform vec3 uSunDirection;\r
uniform vec3 uSunColour;

uniform float uSunIlluminance;\r
uniform vec3 uMoonDirection;\r
uniform vec3 uMoonColour;\r
uniform float uMoonIlluminance;

uniform samplerCube uEnvironment;\r
uniform float uEnvironmentIntensity;

uniform float uVisibility;

float ef_ggx(float nDotH, float roughness) {\r
  float a = roughness * roughness;\r
  float a2 = a * a;\r
  float d = nDotH * nDotH * (a2 - 1.0) + 1.0;\r
  return a2 / max(EPS, PI * d * d);\r
}

float ef_smith(float nDotV, float nDotL, float roughness) {\r
  float k = roughness * roughness * 0.5;\r
  return (nDotV / (nDotV * (1.0 - k) + k)) * (nDotL / (nDotL * (1.0 - k) + k));\r
}

vec3 ef_fresnel(float cosTheta, vec3 f0) {\r
  float m = clamp(1.0 - cosTheta, 0.0, 1.0);\r
  float m2 = m * m;\r
  return f0 + (1.0 - f0) * m2 * m2 * m;\r
}

vec3 ef_directLight(\r
    vec3 L, vec3 colour, float illuminance,\r
    vec3 N, vec3 V, vec3 albedo, vec3 f0, float roughness) {\r
  if (illuminance <= 0.0) return vec3(0.0);

  float nDotL = dot(N, L);\r
  if (nDotL <= 0.0) return vec3(0.0);

  float horizon = smoothstep(-0.035, 0.02, L.y);\r
  if (horizon <= 0.0) return vec3(0.0);

  float nDotV = max(1e-3, dot(N, V));\r
  vec3 H = normalize(L + V);\r
  float nDotH = max(0.0, dot(N, H));

  float D = ef_ggx(nDotH, roughness);\r
  float G = ef_smith(nDotV, nDotL, roughness);\r
  vec3 F = ef_fresnel(max(0.0, dot(H, V)), f0);\r
  vec3 specular = (D * G / (4.0 * nDotV * nDotL + EPS)) * F;

  return colour * illuminance * nDotL * horizon * (albedo * INV_PI * (1.0 - F) + specular);\r
}

vec3 ef_shadeSurface(vec3 albedo, vec3 N, vec3 V, float roughness, float occlusion, vec3 f0) {\r
  vec3 colour = vec3(0.0);\r
  colour += ef_directLight(uSunDirection, uSunColour, uSunIlluminance, N, V, albedo, f0, roughness);\r
  colour += ef_directLight(uMoonDirection, uMoonColour, uMoonIlluminance, N, V, albedo, f0, roughness);

  
  
  
  vec3 irradiance = textureCubeLodEXT(uEnvironment, N, 6.0).rgb * uEnvironmentIntensity;\r
  vec3 R = reflect(-V, N);\r
  vec3 reflection = textureCubeLodEXT(uEnvironment, R, roughness * 7.0).rgb * uEnvironmentIntensity;

  float nDotV = max(1e-3, dot(N, V));\r
  vec3 F = ef_fresnel(nDotV, f0);\r
  colour += albedo * irradiance * occlusion;\r
  colour += reflection * F * occlusion;

  return colour;\r
}

vec3 ef_aerialPerspective(vec3 colour, float distanceToCamera, vec3 V) {\r
  float extinction = 3.912 / max(200.0, uVisibility);\r
  float t = 1.0 - exp(-extinction * distanceToCamera);\r
  return mix(colour, ef_airLight(uEnvironment, uEnvironmentIntensity, V), t);\r
}

#endif

varying vec3 vWorldPosition;\r
varying vec3 vNormal;\r
varying vec2 vQuad;\r
varying float vAlpha;\r
varying float vViewDistance;

uniform float uOpacity;\r

const vec3 SPRAY_ALBEDO = vec3(0.93, 0.955, 0.97);

void main() {\r
  
  
  float mask = 1.0 - smoothstep(0.45, 1.0, length(vQuad));\r
  float alpha = hdrClampAlpha(vAlpha * mask * uOpacity);\r
  if (alpha <= 0.002) discard;

  vec3 viewVector = cameraPosition - vWorldPosition;\r
  vec3 V = viewVector / max(EPS, length(viewVector));\r
  vec3 N = normalize(vNormal);

  
  
  vec3 colour = ef_shadeSurface(SPRAY_ALBEDO, N, V, 0.9, 1.0, vec3(0.02));

  
  
  float through = pow(max(0.0, dot(V, -uSunDirection)), 2.5);\r
  colour += SPRAY_ALBEDO * uSunColour * uSunIlluminance * through * 0.8;

  colour = ef_aerialPerspective(colour, vViewDistance, V);

  
  gl_FragColor = vec4(hdrClamp(colour * alpha), hdrClampAlpha(alpha));\r
}`,nu=128,ru=.7,iu=15,au=20,ou=.4,su=.025,cu=8,lu=384,uu=72,du=16,fu=.15,pu=.85,mu=4.2,hu=6,gu=26,_u=new t(0,0,Ss.length/2-.1),vu=new t(0,.02,-(Ss.length/2-.55)),yu=new t,bu=new t,xu=new t,Su=new t,Cu={transparent:!0,depthWrite:!1,blending:5,blendEquation:100,blendSrc:201,blendDst:205},wu=class{name=`wake`;priority=24;engine;water;hull;ribbon;ribbonGeometry;ribbonMaterial;trackA;trackB;attributeA;attributeB;spray;sprayGeometry;sprayMaterial;slots;foamTexture;waveA=new Float32Array(32);waveB=new Float32Array(32);packScratch=new Float32Array(64);packedBank=null;waveScratch={x:0,y:0,z:0};originX=0;originZ=0;arcLength=0;lastCommitArc=0;laidRows=0;lastX=0;lastZ=0;headingX=0;headingZ=-1;lastWakeTime=-80;emission=0;sprayBudget=lu;constructor(n,r,a){this.engine=n,this.water=r,this.hull=a,this.foamTexture=zr(512,n.settings.world.seed^40503);let o=1920;this.trackA=new Float32Array(o*4),this.trackB=new Float32Array(o*3),this.attributeA=new j(this.trackA,4).setUsage(h),this.attributeB=new j(this.trackB,3).setUsage(h),this.ribbonGeometry=Tu(),this.ribbonGeometry.setAttribute(`aTrackA`,this.attributeA),this.ribbonGeometry.setAttribute(`aTrackB`,this.attributeB),this.ribbonMaterial=new i({vertexShader:Ql,fragmentShader:$l,defines:{MAX_WAVES:cu},uniforms:{...Oo(),uWaveA:{value:this.waveA},uWaveB:{value:this.waveB},uWaveCount:{value:0},uWaveTime:{value:0},uTime:{value:0},uTrackLength:{value:0},uWaterLevel:{value:0},uLifetime:{value:au},uHalfBeam:{value:Ss.beam/2},uAmplitude:{value:ou},uLift:{value:su},uSampleSpacing:{value:ru},uLateralCells:{value:14},uMaxBehind:{value:nu*ru},uValidRows:{value:0},uFoam:{value:this.foamTexture}},...Cu,side:2,polygonOffset:!0,polygonOffsetFactor:-4,polygonOffsetUnits:-8}),this.ribbon=new e(this.ribbonGeometry,this.ribbonMaterial),this.ribbon.frustumCulled=!1,this.ribbon.renderOrder=1;let s=new H(n.settings.world.seed^31310),c=new Float32Array(lu*4);for(let e=0;e<c.length;e+=1)c[e]=s.next();this.slots=new w(new Float32Array(lu),1),this.sprayGeometry=Eu(),this.sprayGeometry.setAttribute(`aSeed`,new w(c,4)),this.sprayGeometry.setAttribute(`aSlot`,this.slots),this.sprayMaterial=new i({vertexShader:eu,fragmentShader:tu,defines:{MAX_WAVES:cu},uniforms:{...Oo(),uWaveA:{value:this.waveA},uWaveB:{value:this.waveB},uWaveCount:{value:0},uWaveTime:{value:0},uTime:{value:0},uCycle:{value:du},uEmitter:{value:new t},uEmitterRight:{value:new t(1,0,0)},uEmitterForward:{value:new t(0,0,-1)},uEmitterVelocity:{value:new t},uWind:{value:new t},uEmission:{value:0},uThrow:{value:0},uSize:{value:fu},uOpacity:{value:pu},uWaterLevel:{value:0}},...Cu,side:2}),this.spray=new e(this.sprayGeometry,this.sprayMaterial),this.spray.frustumCulled=!1,this.spray.renderOrder=2,n.scene.add(this.ribbon,this.spray),this.applyQuality(),this.lastX=a.position.x,this.lastZ=a.position.z,this.seedTrack(0)}update(e,t){let n=t.loop.simTime,r=ko(t);Ao(this.ribbonMaterial.uniforms,t,r),Ao(this.sprayMaterial.uniforms,t,r),this.syncWaveBank();let i=this.hull.velocity,a=Math.hypot(i.x,i.z);this.advanceTrack(n,a),this.updateSpray(e,t,a)}onSettingsChanged(){this.applyQuality()}dispose(){this.engine.scene.remove(this.ribbon,this.spray),this.ribbonGeometry.dispose(),this.ribbonMaterial.dispose(),this.sprayGeometry.dispose(),this.sprayMaterial.dispose(),this.foamTexture.dispose()}applyQuality(){this.sprayBudget=G(Math.round(lu*this.engine.settings.graphics.instanceDensity),uu,lu),this.sprayGeometry.instanceCount=this.sprayBudget;let e=Math.max(1,this.sprayBudget-1);for(let t=0;t<this.sprayBudget;t+=1)this.slots.setX(t,t/e);this.slots.needsUpdate=!0,Du(this.sprayMaterial.uniforms,`uSize`,fu*G(Math.sqrt(lu/this.sprayBudget),1,1.7))}syncWaveBank(){let e=this.water.waveBank;if(e===this.packedBank)return;this.packedBank=e,this.waveA.fill(0),this.waveB.fill(0);let t=e.toUniformArray(this.packScratch);this.waveA.set(this.packScratch.subarray(0,t*4)),this.waveB.set(this.packScratch.subarray(t*4,t*8)),Du(this.ribbonMaterial.uniforms,`uWaveCount`,t),Du(this.sprayMaterial.uniforms,`uWaveCount`,t)}advanceTrack(e,t){bu.set(0,0,-1).applyQuaternion(this.hull.orientation);let n=Math.hypot(bu.x,bu.z);n>1e-4&&(this.headingX=bu.x/n,this.headingZ=bu.z/n);let r=this.hull.position;if(this.arcLength+=Math.hypot(r.x-this.lastX,r.z-this.lastZ),this.lastX=r.x,this.lastZ=r.z,this.arcLength-this.lastCommitArc>nu*ru)this.seedTrack(e);else{let e=0;for(;this.arcLength-this.lastCommitArc>=ru&&e<nu;)this.shiftTrack(),this.lastCommitArc+=ru,this.laidRows=Math.min(127,this.laidRows+1),e+=1}this.writeHead(e,t),t>.3&&(this.lastWakeTime=e),this.ribbon.visible=this.laidRows>0&&e-this.lastWakeTime<au;let i=this.ribbonMaterial.uniforms;Du(i,`uWaveTime`,e),Du(i,`uTime`,e),Du(i,`uTrackLength`,this.arcLength),Du(i,`uWaterLevel`,this.engine.world.tideHeight),Du(i,`uValidRows`,this.laidRows/127)}shiftTrack(){this.trackA.copyWithin(60,0,this.trackA.length-60),this.trackB.copyWithin(45,0,this.trackB.length-45)}undisplace(e,t,n){let r=this.water.waveBank,i=e,a=t;for(let o=0;o<4;o+=1)r.evaluate(i,a,n,this.waveScratch),i+=e-(i+this.waveScratch.x),a+=t-(a+this.waveScratch.z);this.originX=i,this.originZ=a}writeHead(e,t){xu.copy(_u).applyQuaternion(this.hull.orientation).add(this.hull.position),this.undisplace(xu.x,xu.z,e);for(let n=0;n<iu;n+=1){let r=n*4;this.trackA[r]=this.originX,this.trackA[r+1]=this.originZ,this.trackA[r+2]=e,this.trackA[r+3]=this.arcLength;let i=n*3;this.trackB[i]=this.headingX,this.trackB[i+1]=this.headingZ,this.trackB[i+2]=t}this.attributeA.needsUpdate=!0,this.attributeB.needsUpdate=!0}seedTrack(e){xu.copy(_u).applyQuaternion(this.hull.orientation).add(this.hull.position),this.undisplace(xu.x,xu.z,e);let t=e-80;for(let e=0;e<1920;e+=1){let n=e*4;this.trackA[n]=this.originX,this.trackA[n+1]=this.originZ,this.trackA[n+2]=t,this.trackA[n+3]=this.arcLength;let r=e*3;this.trackB[r]=this.headingX,this.trackB[r+1]=this.headingZ,this.trackB[r+2]=0}this.lastCommitArc=this.arcLength,this.laidRows=0,this.attributeA.needsUpdate=!0,this.attributeB.needsUpdate=!0}updateSpray(e,t,n){let r=this.hull,i=G((r.verticalAcceleration-hu)/gu,0,1),a=G(n/mu,0,1),o=G(a*a*a+i*.85,0,1);this.emission=K(this.emission,o,12,e);let s=this.sprayMaterial.uniforms,c=t.loop.simTime;Du(s,`uTime`,c%du),Du(s,`uWaveTime`,c),Du(s,`uWaterLevel`,t.world.tideHeight),Du(s,`uEmission`,this.emission),Du(s,`uThrow`,1.4+n*.85+i*3.2),Ou(s,`uEmitter`,xu.copy(vu).applyQuaternion(r.orientation).add(r.position)),Ou(s,`uEmitterRight`,yu.set(1,0,0).applyQuaternion(r.orientation)),Ou(s,`uEmitterForward`,bu.set(0,0,-1).applyQuaternion(r.orientation)),Ou(s,`uEmitterVelocity`,r.velocity),Ou(s,`uWind`,Su.set(t.world.windX,0,t.world.windZ)),this.spray.visible=this.emission>.002}};function Tu(){let e=new Float32Array(5760);for(let t=0;t<nu;t+=1)for(let n=0;n<iu;n+=1){let r=(t*iu+n)*3;e[r]=n/14*2-1,e[r+1]=0,e[r+2]=t/127}let t=new Uint16Array(10668),n=0;for(let e=0;e<127;e+=1)for(let r=0;r<14;r+=1){let i=e*iu+r,a=i+1,o=i+iu,s=o+1;t[n]=i,t[n+1]=o,t[n+2]=a,t[n+3]=a,t[n+4]=o,t[n+5]=s,n+=6}let r=new L;return r.setAttribute(`position`,new j(e,3)),r.setIndex(new j(t,1)),r.boundingSphere=null,r}function Eu(){let e=new O;return e.setAttribute(`position`,new j(new Float32Array([-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,.5,0]),3)),e.setIndex(new j(new Uint16Array([0,1,2,0,2,3]),1)),e.boundingSphere=null,e}function Du(e,t,n){let r=e[t];r!==void 0&&(r.value=n)}function Ou(e,t,n){let r=e[t];r!==void 0&&r.value.copy(n)}var ku=4,Au=.05,ju={white:2048801541,pink:2620592557,brown:1300332515},Mu=1e-4,Nu=420,Pu=2e4;function Fu(e,t){for(let n=0;n<e.length;n+=1)e[n]=t.next()*2-1}function Iu(e,t){let n=0,r=0,i=0,a=0,o=0,s=0,c=0;for(let l=-4096;l<e.length;l+=1){let u=t.next()*2-1;n=.99886*n+u*.0555179,r=.99332*r+u*.0750759,i=.969*i+u*.153852,a=.8665*a+u*.3104856,o=.55*o+u*.5329522,s=-.7616*s-u*.016898;let d=n+r+i+a+o+s+c+u*.5362;c=u*.115926,l>=0&&(e[l]=d)}Ru(e,.9)}function Lu(e,t){let n=0;for(let r=-4096;r<e.length;r+=1){let i=t.next()*2-1;n=(n+.02*i)/1.02,r>=0&&(e[r]=n)}Ru(e,.9)}function Ru(e,t){let n=0;for(let t=0;t<e.length;t+=1){let r=Math.abs(e[t]??0);r>n&&(n=r)}if(n<=0)return;let r=t/n;for(let t=0;t<e.length;t+=1)e[t]=(e[t]??0)*r}function zu(e,t,n){let r=t.length;for(let n=0;n<r;n+=1)t[n]=e[n]??0;let i=Math.min(n,r);for(let n=0;n<i;n+=1){let a=n/i*Math.PI*.5;t[n]=(e[r+n]??0)*Math.cos(a)+(e[n]??0)*Math.sin(a)}}function Bu(e,t,n,r,i){let a=0,o=0,s=Math.min(e.length,t.length);for(let c=0;c<s;c+=1){let s=c/n/r,l=Math.max(0,1-s)**2.6,u=.65*(1-s)+.04;a+=((i.next()*2-1)*l-a)*u,o+=((i.next()*2-1)*l-o)*u,e[c]=a,t[c]=o}Ru(e,.7),Ru(t,.7)}var Vu=class{source;filter;amp;context;running=!1;constructor(e,t,n,r){this.context=e,this.source=e.createBufferSource(),this.source.buffer=t,this.source.loop=!0,this.source.playbackRate.value=n.rate??1,this.filter=e.createBiquadFilter(),this.filter.type=n.filter??`lowpass`,this.filter.frequency.value=n.frequency??800,this.filter.Q.value=n.q??.7,this.amp=e.createGain(),this.amp.gain.value=n.gain??0,this.source.connect(this.filter),this.filter.connect(this.amp),this.amp.connect(n.destination??r)}start(){this.running||(this.running=!0,this.source.start(0,Math.random()*(this.source.buffer?.duration??1)))}setGain(e,t=.15){this.amp.gain.setTargetAtTime(Math.max(0,e),this.context.currentTime,t)}setFrequency(e,t=.25){this.filter.frequency.setTargetAtTime(Math.max(10,e),this.context.currentTime,t)}setQ(e){this.filter.Q.setTargetAtTime(Math.max(.05,e),this.context.currentTime,.2)}setRate(e,t=.4){this.source.playbackRate.setTargetAtTime(Math.max(.05,e),this.context.currentTime,t)}dispose(){this.running&&this.source.stop(),this.source.disconnect(),this.filter.disconnect(),this.amp.disconnect(),this.running=!1}},Hu=class{carrier;modulator;modGain;amp;context;ratio;index;frequency;running=!1;constructor(e,t,n){this.context=e,this.frequency=t.carrier??110,this.ratio=t.ratio??2,this.index=t.index??1,this.carrier=e.createOscillator(),this.carrier.type=t.carrierType??`sine`,this.carrier.frequency.value=this.frequency,this.modulator=e.createOscillator(),this.modulator.type=t.modulatorType??`sine`,this.modulator.frequency.value=this.frequency*this.ratio,this.modGain=e.createGain(),this.modGain.gain.value=this.frequency*this.ratio*this.index,this.amp=e.createGain(),this.amp.gain.value=t.gain??0,this.modulator.connect(this.modGain),this.modGain.connect(this.carrier.frequency),this.carrier.connect(this.amp),this.amp.connect(t.destination??n)}start(){this.running||(this.running=!0,this.carrier.start(),this.modulator.start())}setFrequency(e,t=.08){this.frequency=Math.max(1,e);let n=this.context.currentTime;this.carrier.frequency.setTargetAtTime(this.frequency,n,t),this.modulator.frequency.setTargetAtTime(this.frequency*this.ratio,n,t),this.modGain.gain.setTargetAtTime(this.frequency*this.ratio*this.index,n,t)}setIndex(e,t=.12){this.index=Math.max(0,e),this.modGain.gain.setTargetAtTime(this.frequency*this.ratio*this.index,this.context.currentTime,t)}setGain(e,t=.1){this.amp.gain.setTargetAtTime(Math.max(0,e),this.context.currentTime,t)}dispose(){this.running&&(this.carrier.stop(),this.modulator.stop()),this.carrier.disconnect(),this.modulator.disconnect(),this.modGain.disconnect(),this.amp.disconnect(),this.running=!1}};function Uu(e,t,n,r,i){let a=Math.max(Mu*2,n);return e.setValueAtTime(Mu,t),e.exponentialRampToValueAtTime(a,t+r),e.exponentialRampToValueAtTime(Mu,t+r+i),t+r+i}var Wu=class e{context;sfxBus;musicBus;reverbInput;masterGain;muffle;compressor;convolver;settings;unsubscribe;noiseBuffers=new Map;resumeHandler;duck=1;disposed=!1;static create(t){return typeof AudioContext>`u`?null:new e(t)}constructor(e){this.settings=e,this.context=new AudioContext({latencyHint:`interactive`}),this.masterGain=this.context.createGain(),this.masterGain.gain.value=0,this.masterGain.connect(this.context.destination),this.compressor=this.context.createDynamicsCompressor(),this.compressor.threshold.value=-14,this.compressor.knee.value=12,this.compressor.ratio.value=4,this.compressor.attack.value=.004,this.compressor.release.value=.25,this.compressor.connect(this.masterGain),this.muffle=this.context.createBiquadFilter(),this.muffle.type=`lowpass`,this.muffle.frequency.value=Pu,this.muffle.Q.value=.7,this.muffle.connect(this.compressor),this.sfxBus=this.context.createGain(),this.sfxBus.gain.value=1,this.sfxBus.connect(this.muffle),this.musicBus=this.context.createGain(),this.musicBus.gain.value=0,this.musicBus.connect(this.muffle),this.convolver=this.context.createConvolver(),this.convolver.buffer=this.buildImpulseResponse(1.9),this.convolver.connect(this.muffle),this.reverbInput=this.convolver;let t=this.context.listener;t.forwardZ.value=-1,t.upY.value=1,this.applySettings(),this.unsubscribe=e.onChange((e,t)=>{t===`audio`&&this.applySettings()}),this.resumeHandler=()=>{this.resume()},this.installGestureListeners()}now(){return this.context.currentTime}get running(){return this.context.state===`running`}noiseBuffer(e){let t=this.noiseBuffers.get(e);if(t!==void 0)return t;let n=this.buildNoise(e);return this.noiseBuffers.set(e,n),n}createNoiseVoice(e){return new Vu(this.context,this.noiseBuffer(e.kind),e,this.sfxBus)}createFmVoice(e){return new Hu(this.context,e,this.sfxBus)}createPanner(){let e=this.context.createPanner();return e.panningModel=`HRTF`,e.distanceModel=`inverse`,e.refDistance=12,e.maxDistance=4e3,e.rolloffFactor=.9,e.connect(this.sfxBus),e}createReverbSend(e){let t=this.context.createGain();return t.gain.value=e,t.connect(this.convolver),t}setPosition(e,t,n,r){let i=this.context.currentTime;e.positionX.setValueAtTime(t,i),e.positionY.setValueAtTime(n,i),e.positionZ.setValueAtTime(r,i)}setListener(e,t,n,r,i,a){let o=this.context.listener,s=this.context.currentTime;o.positionX.setTargetAtTime(e,s,.02),o.positionY.setTargetAtTime(t,s,.02),o.positionZ.setTargetAtTime(n,s,.02),o.forwardX.setTargetAtTime(r,s,.05),o.forwardY.setTargetAtTime(i,s,.05),o.forwardZ.setTargetAtTime(a,s,.05)}setSubmersion(e){let t=Pu*(Nu/Pu)**+Math.min(1,Math.max(0,e));this.muffle.frequency.setTargetAtTime(t,this.context.currentTime,.12)}setMusicDuck(e){this.duck=Math.min(1,Math.max(0,e)),this.applySettings()}playNoiseBurst(e){let t=this.context,n=e.when??t.currentTime,r=e.attack??.004,i=e.decay??.25,a=t.createBufferSource();a.buffer=this.noiseBuffer(e.kind??`white`),a.loop=!0,a.playbackRate.value=e.rate??1;let o=t.createBiquadFilter();o.type=e.filter??`bandpass`;let s=e.frequency??900;o.frequency.setValueAtTime(s,n),e.sweepTo!==void 0&&o.frequency.exponentialRampToValueAtTime(Math.max(20,e.sweepTo),n+r+i),o.Q.value=e.q??1;let c=t.createGain(),l=Uu(c.gain,n,e.gain??.4,r,i);a.connect(o),o.connect(c),c.connect(e.destination??this.sfxBus),a.start(n,Math.random()*ku*.5),a.stop(l+.02),a.onended=()=>{a.disconnect(),o.disconnect(),c.disconnect()}}playTone(e){let t=this.context,n=e.when??t.currentTime,r=e.attack??.01,i=e.decay??.5,a=t.createOscillator();a.type=e.type??`sine`,a.frequency.setValueAtTime(Math.max(1,e.frequency),n),e.sweepTo!==void 0&&a.frequency.exponentialRampToValueAtTime(Math.max(1,e.sweepTo),n+r+i);let o=t.createGain(),s=Uu(o.gain,n,e.gain??.3,r,i),c=a,l=null;e.filter!==void 0&&(l=t.createBiquadFilter(),l.type=e.filter,l.frequency.value=e.filterFrequency??e.frequency*2,l.Q.value=e.q??1,a.connect(l),c=l),c.connect(o),o.connect(e.destination??this.sfxBus),a.start(n),a.stop(s+.02),a.onended=()=>{a.disconnect(),l?.disconnect(),o.disconnect()}}dispose(){this.disposed||(this.disposed=!0,this.unsubscribe(),this.removeGestureListeners(),this.sfxBus.disconnect(),this.musicBus.disconnect(),this.convolver.disconnect(),this.muffle.disconnect(),this.compressor.disconnect(),this.masterGain.disconnect(),this.noiseBuffers.clear(),this.context.close().catch(()=>void 0))}resume(){this.disposed||this.context.state===`running`||this.context.resume().then(()=>{this.removeGestureListeners()}).catch(()=>void 0)}installGestureListeners(){typeof window>`u`||(window.addEventListener(`pointerdown`,this.resumeHandler,{passive:!0}),window.addEventListener(`keydown`,this.resumeHandler,{passive:!0}),window.addEventListener(`touchend`,this.resumeHandler,{passive:!0}))}removeGestureListeners(){typeof window>`u`||(window.removeEventListener(`pointerdown`,this.resumeHandler),window.removeEventListener(`keydown`,this.resumeHandler),window.removeEventListener(`touchend`,this.resumeHandler))}applySettings(){let e=this.settings.audio,t=this.context.currentTime,n=e.muted?0:Math.min(1,Math.max(0,e.masterVolume));this.masterGain.gain.setTargetAtTime(n,t,.05),this.musicBus.gain.setTargetAtTime(Math.min(1,Math.max(0,e.musicVolume))*this.duck,t,.4)}buildNoise(e){let t=this.context.sampleRate,n=Math.floor(ku*t),r=Math.floor(Au*t),i=new Float32Array(n+r),a=new H(ju[e]);e===`white`?Fu(i,a):e===`pink`?Iu(i,a):Lu(i,a);let o=new Float32Array(n);zu(i,o,r);let s=this.context.createBuffer(1,n,t);return s.copyToChannel(o,0),s}buildImpulseResponse(e){let t=this.context.sampleRate,n=Math.max(1,Math.floor(e*t)),r=this.context.createBuffer(2,n,t),i=new Float32Array(n),a=new Float32Array(n);return Bu(i,a,t,e,new H(520789319)),r.copyToChannel(i,0),r.copyToChannel(a,1),r}},Gu=.032,Ku=.2,qu=.018,Ju=.11,Yu=3.6,Xu=7.5,Zu=.15,Qu=2100,$u=1500,ed=.01,td=.14,nd=.2,rd=.006,id=.0032,ad=.052,od=3600,sd=.3,cd=1600,ld=5200,ud=.15,dd=2450,fd=1.7,pd=.16,md=4,hd=.03,gd=.085,_d=1.6,vd=4.6,yd=.016,bd=.055,xd=1.1,Sd=14,Cd=26,wd=.25,Td=.72,Ed=.14,Dd=1.6,Od=.17,kd=1500,Ad=.85,jd=850,Md=.75,Nd=1100,Pd=1400,Fd=55,Id=3e3,Ld=.35,Rd=55e-5,zd=6,Bd=.5,Vd=.18;function Hd(e){let t=G(e/5,0,1);return Gu+Ku*Math.sqrt(t)}function Ud(e){return Zu*W(Yu,Xu,e)}function Wd(e,t){return G(nd*Math.max(0,e)/Math.max(1e-4,t),90,od)}function Gd(e){return Math.max(0,e)/60*(md/2)}function Kd(e){let t=e-Sd;return t<=0?0:G(t/Cd,0,1)**.7}function qd(){return{crackGain:0,rumbleGain:0,cutoffHz:Pd,decayS:Ld}}function Jd(e,t,n){let r=Math.max(0,e),i=G(t,0,1);n.crackGain=Ad*i*Math.exp(-r/jd),n.rumbleGain=Md*i*(Nd/(Nd+r)),n.cutoffHz=Math.max(Fd,Pd*Math.exp(-r/Id)),n.decayS=Math.min(zd,Ld+r*Rd)}var Yd=new t,Xd=class{name=`audio`;priority=92;boat;underwater;tackle;settings;unsubscribeLightning;startHandler;thunder=qd();audio=null;graph=null;booted=!1;disposed=!1;rpm=0;running=0;slamArmed=!0;slamLockout=0;tackleState=`idle`;fishDistance=0;lineOutRate=0;peakTension=0;pannerCursor=0;constructor(e,t){this.boat=t.boat,this.underwater=t.underwater,this.tackle=t.tackle,this.settings=e.settings,this.unsubscribeLightning=t.weather.onLightning(this.handleStrike),this.startHandler=()=>{this.boot()},typeof window<`u`&&(window.addEventListener(`pointerdown`,this.startHandler,{passive:!0}),window.addEventListener(`keydown`,this.startHandler,{passive:!0}),window.addEventListener(`touchend`,this.startHandler,{passive:!0}))}fixedUpdate(e){let t=this.audio,n=this.graph;if(t===null||n===null)return;this.slamLockout=Math.max(0,this.slamLockout-e);let r=this.boat.verticalAcceleration;if(!this.slamArmed){r<8&&(this.slamArmed=!0);return}let i=Kd(r);i<=0||(this.slamArmed=!1,!(this.slamLockout>0)&&(this.slamLockout=wd,this.playSlam(t,n,i)))}update(e,t){let n=this.audio,r=this.graph;if(n===null||r===null)return;let i=t.camera;i.getWorldDirection(Yd),n.setListener(i.position.x,i.position.y,i.position.z,Yd.x,Yd.y,Yd.z);let a=t.world,o=vi(a.windSpeed);this.updateSea(r,a.significantWaveHeight,o),this.updateWind(r,a.windSpeed),this.updateRain(r,a.precipitation),this.updateEngine(e,r),this.updateSubmersion(n,r,a.significantWaveHeight),this.updateTackle(e,n,r)}dispose(){if(this.disposed)return;this.disposed=!0,this.unsubscribeLightning(),this.removeGestureListeners();let e=this.graph;if(e!==null){e.seaRumble.dispose(),e.seaWash.dispose(),e.whitecaps.dispose(),e.windBed.dispose(),e.shroud.dispose(),e.halyard.dispose(),e.rainHiss.dispose(),e.rainDeck.dispose(),e.exhaust.dispose(),e.engine.dispose(),e.submerged.dispose(),e.reelDrag.dispose();for(let t of e.panners)t.disconnect();e.thunderSend.disconnect(),e.thunderBus.disconnect(),e.airSend.disconnect(),e.airBus.disconnect(),this.graph=null}this.audio?.dispose(),this.audio=null}boot(){if(this.booted||this.disposed)return;this.booted=!0,this.removeGestureListeners();let e=null;try{e=Wu.create(this.settings)}catch{return}e!==null&&(this.audio=e,this.graph=this.buildGraph(e))}removeGestureListeners(){typeof window>`u`||(window.removeEventListener(`pointerdown`,this.startHandler),window.removeEventListener(`keydown`,this.startHandler),window.removeEventListener(`touchend`,this.startHandler))}buildGraph(e){let t=e.context,n=t.createGain();n.gain.value=1,n.connect(e.sfxBus);let r=e.createReverbSend(Vd);n.connect(r);let i=t.createGain();i.gain.value=1,i.connect(e.sfxBus);let a=e.createReverbSend(Bd);i.connect(a);let o=[];for(let t=0;t<4;t+=1){let t=e.createPanner();t.rolloffFactor=0,t.refDistance=1,t.disconnect(),t.connect(i),o.push(t)}let s=e.createFmVoice({carrier:Gd(700),ratio:1,index:_d,gain:0,carrierType:`sine`,modulatorType:`triangle`,destination:n});s.start();let c=(t,r,i,a,o,s=n)=>{let c=e.createNoiseVoice({kind:t,filter:r,frequency:i,q:a,rate:o,destination:s});return c.start(),c};return{airBus:n,airSend:r,thunderBus:i,thunderSend:a,panners:o,engine:s,seaRumble:c(`brown`,`lowpass`,130,.6,.85),seaWash:c(`pink`,`bandpass`,480,.8,1),whitecaps:c(`white`,`highpass`,Qu,.7,1),windBed:c(`pink`,`bandpass`,210,.9,1),shroud:c(`white`,`bandpass`,90,7,1),halyard:c(`white`,`bandpass`,90,9,1),rainHiss:c(`white`,`lowpass`,cd,1.3,1),rainDeck:c(`pink`,`bandpass`,190,1.1,1),exhaust:c(`brown`,`lowpass`,90,.8,1),reelDrag:c(`white`,`bandpass`,700,6,1),submerged:c(`brown`,`lowpass`,220,.9,.7,e.sfxBus)}}updateSea(e,t,n){let r=G(t/5,0,1);e.seaRumble.setGain(Hd(t),.7),e.seaRumble.setFrequency(130+190*r,.9),e.seaWash.setGain(qu+Ju*Math.sqrt(r),.7),e.whitecaps.setGain(Ud(n),.9),e.whitecaps.setFrequency(Qu+$u*n/12,1.2)}updateWind(e,t){let n=G(t/22,0,1);e.windBed.setGain(ed+td*n**1.5,.6),e.windBed.setFrequency(210+62*t,.8);let r=W(4,17,t),i=ad*r*r;e.shroud.setGain(i,.5),e.shroud.setFrequency(Wd(t,rd),.4),e.halyard.setGain(i*.65,.5),e.halyard.setFrequency(Wd(t,id),.4)}updateRain(e,t){let n=G(t,0,1);e.rainHiss.setGain(sd*n**.7,.5),e.rainHiss.setFrequency(cd+ld*n,.6),e.rainDeck.setGain(ud*n,.5)}updateEngine(e,t){let n=G(Math.abs(this.boat.throttleSetting),0,1),r=G(n-G(this.boat.speedKnots/8,0,1),0,1);this.running=K(this.running,+!this.boat.isAnchored,xd,e);let i=(700+(dd-700)*n*(1-pd*r))*this.running;this.rpm=K(this.rpm,i,fd,e);let a=Gd(this.rpm),o=G(this.rpm/dd,0,1);t.engine.setFrequency(Math.max(1,a)),t.engine.setIndex(_d+vd*r),t.engine.setGain((hd+gd*n)*this.running);let s=yd+bd*o*(.4+.6*r);t.exhaust.setGain(s*this.running,.2),t.exhaust.setFrequency(90+a*3,.2)}updateSubmersion(e,t,n){let r=G(this.underwater.submersion,0,1);e.setSubmersion(r),t.airBus.gain.setTargetAtTime(1-Td*r,e.now(),.08);let i=G(n/5,0,1);t.submerged.setGain(Ed*r*(.55+.45*i),.12)}updateTackle(e,t,n){let r=this.tackle,i=r.state;if(i!==this.tackleState){let e=this.tackleState;this.tackleState=i,i===`sinking`&&e===`casting`?this.playCastSplash(t,n):i===`bite`?this.playBite(t,n):i===`fighting`?(this.peakTension=0,this.lineOutRate=0,this.fishDistance=r.fishDistanceM):i===`landed`&&this.playLandingSplash(t,n)}let a=G(r.tension,0,1),o=0;if(i===`fighting`){a>this.peakTension&&(this.peakTension=a);let t=r.fishDistanceM;e>1e-4&&(o=G((t-this.fishDistance)/e/Dd,0,1)),this.fishDistance=t}this.lineOutRate=K(this.lineOutRate,o,8,e);let s=this.lineOutRate;n.reelDrag.setGain(Od*s*(.3+.7*a),.05),n.reelDrag.setFrequency(700+kd*s,.05),n.reelDrag.setRate(.7+s,.06)}playSlam(e,t,n){let r=t.airBus;e.playTone({frequency:78-22*n,sweepTo:34,type:`sine`,gain:.45*n,attack:.004,decay:.26+.2*n,destination:r}),e.playNoiseBurst({kind:`pink`,filter:`lowpass`,frequency:900+700*n,sweepTo:160,q:.9,gain:.5*n,attack:.002,decay:.22+.18*n,destination:r}),e.playNoiseBurst({kind:`white`,filter:`highpass`,frequency:2600,q:.7,gain:.22*n,attack:.02,decay:.5+.4*n,destination:r})}playCastSplash(e,t){let n=t.airBus;e.playNoiseBurst({kind:`white`,filter:`bandpass`,frequency:2400,sweepTo:700,q:.8,gain:.3,attack:.003,decay:.3,destination:n}),e.playTone({frequency:420,sweepTo:150,type:`sine`,gain:.16,attack:.004,decay:.16,destination:n})}playBite(e,t){e.playTone({frequency:640,sweepTo:260,type:`sine`,gain:.12,attack:.003,decay:.12,destination:t.airBus})}playLandingSplash(e,t){let n=.4+.6*this.peakTension,r=t.airBus;e.playNoiseBurst({kind:`white`,filter:`bandpass`,frequency:1800,sweepTo:420,q:.7,gain:.42*n,attack:.004,decay:.2+.55*n,destination:r}),e.playTone({frequency:300,sweepTo:110,type:`sine`,gain:.24*n,attack:.005,decay:.3,destination:r})}handleStrike=e=>{let t=this.audio,n=this.graph;if(t===null||n===null)return;let r=n.panners[this.pannerCursor%n.panners.length];if(this.pannerCursor+=1,r===void 0)return;t.setPosition(r,e.x,300,e.z);let i=this.thunder;Jd(e.distanceM,e.intensity,i);let a=t.now()+e.thunderDelaySeconds;i.crackGain>.001&&t.playNoiseBurst({kind:`white`,filter:`bandpass`,frequency:1800,sweepTo:420,q:.7,gain:i.crackGain,attack:.002,decay:.32,destination:r,when:a}),t.playNoiseBurst({kind:`brown`,filter:`lowpass`,q:.9,rate:.7,frequency:i.cutoffHz*2.2,sweepTo:i.cutoffHz*.5,gain:i.rumbleGain,attack:Math.min(.4,.015+i.decayS*.12),decay:i.decayS,destination:r,when:a+.04})}},Zd=8388608;function Qd(e,t){return e*Zd+t}var $d=class{factory;seed;creationBudget;hysteresis;poolLimit;slots=new Map;payloads=[];keys=[];coords=[];pool=[];offsets=new Int32Array;radius=0;radiusSquared=0;retireRadiusSquared=0;centreX=0;centreZ=0;scanIndex=0;centred=!1;constructor(e,t,n={}){this.factory=e,this.seed=t>>>0,this.creationBudget=Math.max(1,n.creationBudget??2),this.hysteresis=Math.max(0,n.hysteresis??1),this.poolLimit=Math.max(0,n.poolLimit??24),this.setDrawDistance(e.chunkSize*3)}get count(){return this.payloads.length}get active(){return this.payloads}get settled(){return this.centred&&this.scanIndex>=this.offsets.length}centreXOf(e){return((this.coords[e*2]??0)+.5)*this.factory.chunkSize}centreZOf(e){return((this.coords[e*2+1]??0)+.5)*this.factory.chunkSize}get(e,t){let n=this.slots.get(Qd(e,t));return n===void 0?void 0:this.payloads[n]}setDrawDistance(e){let t=Math.max(1,Math.ceil(e/this.factory.chunkSize));if(t===this.radius&&this.offsets.length>0)return;this.radius=t,this.radiusSquared=t*t;let n=t+this.hysteresis;this.retireRadiusSquared=n*n;let r=[];for(let e=-t;e<=t;e+=1)for(let n=-t;n<=t;n+=1)n*n+e*e>this.radiusSquared||r.push(n,e);let i=[];for(let e=0;e<r.length;e+=2)i.push(e);i.sort((e,t)=>{let n=r[e]??0,i=r[e+1]??0,a=r[t]??0,o=r[t+1]??0;return n*n+i*i-(a*a+o*o)});let a=new Int32Array(i.length*2);for(let e=0;e<i.length;e+=1){let t=i[e]??0;a[e*2]=r[t]??0,a[e*2+1]=r[t+1]??0}this.offsets=a,this.scanIndex=0,this.sweep()}update(e,t){let n=this.factory.chunkSize,r=Math.floor(e/n),i=Math.floor(t/n);(!this.centred||r!==this.centreX||i!==this.centreZ)&&(this.centreX=r,this.centreZ=i,this.centred=!0,this.scanIndex=0,this.sweep());let a=0;for(;this.scanIndex<this.offsets.length&&a<this.creationBudget;){let e=this.scanIndex;this.scanIndex+=2;let t=r+(this.offsets[e]??0),n=i+(this.offsets[e+1]??0);this.slots.has(Qd(t,n))||(this.spawn(t,n),a+=1)}}dispose(){for(let e of this.payloads)this.factory.destroy(e);for(let e of this.pool)this.factory.destroy(e);this.payloads.length=0,this.keys.length=0,this.coords.length=0,this.pool.length=0,this.slots.clear(),this.centred=!1}spawn(e,t){let n=H.deriveStream(this.seed,e,t),r=this.factory.reset===void 0?void 0:this.pool.pop(),i;r===void 0?i=this.factory.create(e,t,n):(i=r,this.factory.reset?.(i,e,t,n)),this.slots.set(Qd(e,t),this.payloads.length),this.payloads.push(i),this.keys.push(Qd(e,t)),this.coords.push(e,t)}sweep(){for(let e=this.payloads.length-1;e>=0;--e){let t=(this.coords[e*2]??0)-this.centreX,n=(this.coords[e*2+1]??0)-this.centreZ;t*t+n*n<=this.retireRadiusSquared||this.release(e)}}release(e){let t=this.payloads[e],n=this.keys[e];if(t===void 0||n===void 0)return;this.factory.retire(t),this.slots.delete(n);let r=this.payloads.length-1;if(e!==r){let t=this.payloads[r],n=this.keys[r];t!==void 0&&n!==void 0&&(this.payloads[e]=t,this.keys[e]=n,this.coords[e*2]=this.coords[r*2]??0,this.coords[e*2+1]=this.coords[r*2+1]??0,this.slots.set(n,e))}this.payloads.length=r,this.keys.length=r,this.coords.length=r*2,this.factory.reset!==void 0&&this.pool.length<this.poolLimit?this.pool.push(t):this.factory.destroy(t)}},ef=`precision highp float;

#ifndef ENDLESS_FISHING_CONSTANTS\r
#define ENDLESS_FISHING_CONSTANTS

const float PI = 3.14159265358979323846;\r
const float TWO_PI = 6.28318530717958647692;\r
const float HALF_PI = 1.57079632679489661923;\r
const float INV_PI = 0.31830988618379067154;\r
const float INV_FOUR_PI = 0.07957747154594766788;\r
const float DEG_TO_RAD = 0.01745329251994329577;\r
const float RAD_TO_DEG = 57.2957795130823208768;

const float EPS = 1e-6;

#ifndef saturate\r
float saturate(float x) { return clamp(x, 0.0, 1.0); }\r
vec2 saturate(vec2 x) { return clamp(x, 0.0, 1.0); }\r
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }\r
#endif

float ef_luminance(vec3 colour) {\r
  return dot(colour, vec3(0.2126, 0.7152, 0.0722));\r
}

float remap(float x, float lowIn, float highIn, float lowOut, float highOut) {\r
  float span = highIn - lowIn;\r
  float t = span == 0.0 ? step(lowIn, x) : (x - lowIn) / span;\r
  return lowOut + saturate(t) * (highOut - lowOut);\r
}

vec3 hdrClamp(vec3 colour) {\r
  vec3 safe;\r
  safe.x = colour.x == colour.x ? colour.x : 0.0;\r
  safe.y = colour.y == colour.y ? colour.y : 0.0;\r
  safe.z = colour.z == colour.z ? colour.z : 0.0;\r
  
  
  return clamp(safe, vec3(0.0), vec3(60000.0));\r
}

float hdrClampAlpha(float alpha) {\r
  return clamp(alpha == alpha ? alpha : 0.0, 0.0, 1.0);\r
}

#endif

attribute float aSway;

attribute float aMaterial;

uniform vec2 uCurrent;

uniform vec2 uSurgeDirection;
uniform float uSurgeFrequency;

uniform float uSurgeSpeed;
uniform float uTime;

uniform float uSwayScale;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vMaterial;
varying float vSway;
varying float vViewDistance;

void main() {
  vec3 local = position;

  #ifdef USE_INSTANCING
    vec3 rootWorld = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  #else
    vec3 rootWorld = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  #endif

  
  
  float wavenumber = uSurgeFrequency * uSurgeFrequency / 9.80665;
  float surgePhase = wavenumber * dot(uSurgeDirection, rootWorld.xz) - uSurgeFrequency * uTime;
  vec2 flow = uCurrent + uSurgeDirection * uSurgeSpeed * sin(surgePhase);

  float lean = aSway * aSway * uSwayScale;
  local.xz += flow * lean;
  
  local.y -= aSway * lean * lean * 0.4;

  #ifdef USE_INSTANCING
    vec4 world = modelMatrix * instanceMatrix * vec4(local, 1.0);
    vec3 worldNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  #else
    vec4 world = modelMatrix * vec4(local, 1.0);
    vec3 worldNormal = normalize(mat3(modelMatrix) * normal);
  #endif

  vWorldPosition = world.xyz;
  vNormal = worldNormal;
  vUv = uv;
  vMaterial = aMaterial;
  vSway = aSway;
  vViewDistance = distance(world.xyz, cameraPosition);

  gl_Position = projectionMatrix * viewMatrix * world;
}`,tf=`precision highp float;

#ifndef ENDLESS_FISHING_WORLDLIGHT\r
#define ENDLESS_FISHING_WORLDLIGHT

#ifndef ENDLESS_FISHING_CONSTANTS\r
#define ENDLESS_FISHING_CONSTANTS

const float PI = 3.14159265358979323846;\r
const float TWO_PI = 6.28318530717958647692;\r
const float HALF_PI = 1.57079632679489661923;\r
const float INV_PI = 0.31830988618379067154;\r
const float INV_FOUR_PI = 0.07957747154594766788;\r
const float DEG_TO_RAD = 0.01745329251994329577;\r
const float RAD_TO_DEG = 57.2957795130823208768;

const float EPS = 1e-6;

#ifndef saturate\r
float saturate(float x) { return clamp(x, 0.0, 1.0); }\r
vec2 saturate(vec2 x) { return clamp(x, 0.0, 1.0); }\r
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }\r
#endif

float ef_luminance(vec3 colour) {\r
  return dot(colour, vec3(0.2126, 0.7152, 0.0722));\r
}

float remap(float x, float lowIn, float highIn, float lowOut, float highOut) {\r
  float span = highIn - lowIn;\r
  float t = span == 0.0 ? step(lowIn, x) : (x - lowIn) / span;\r
  return lowOut + saturate(t) * (highOut - lowOut);\r
}

vec3 hdrClamp(vec3 colour) {\r
  vec3 safe;\r
  safe.x = colour.x == colour.x ? colour.x : 0.0;\r
  safe.y = colour.y == colour.y ? colour.y : 0.0;\r
  safe.z = colour.z == colour.z ? colour.z : 0.0;\r
  
  
  return clamp(safe, vec3(0.0), vec3(60000.0));\r
}

float hdrClampAlpha(float alpha) {\r
  return clamp(alpha == alpha ? alpha : 0.0, 0.0, 1.0);\r
}

#endif\r
#ifndef ENDLESS_FISHING_AIRLIGHT\r
#define ENDLESS_FISHING_AIRLIGHT

vec3 ef_airLight(samplerCube environment, float intensity, vec3 V) {\r
  vec3 direction = normalize(vec3(-V.x, max(-V.y, 0.07), -V.z) + vec3(EPS, 0.0, 0.0));\r
  return textureCubeLodEXT(environment, direction, 1.0).rgb * intensity;\r
}

#endif

uniform vec3 uSunDirection;\r
uniform vec3 uSunColour;

uniform float uSunIlluminance;\r
uniform vec3 uMoonDirection;\r
uniform vec3 uMoonColour;\r
uniform float uMoonIlluminance;

uniform samplerCube uEnvironment;\r
uniform float uEnvironmentIntensity;

uniform float uVisibility;

float ef_ggx(float nDotH, float roughness) {\r
  float a = roughness * roughness;\r
  float a2 = a * a;\r
  float d = nDotH * nDotH * (a2 - 1.0) + 1.0;\r
  return a2 / max(EPS, PI * d * d);\r
}

float ef_smith(float nDotV, float nDotL, float roughness) {\r
  float k = roughness * roughness * 0.5;\r
  return (nDotV / (nDotV * (1.0 - k) + k)) * (nDotL / (nDotL * (1.0 - k) + k));\r
}

vec3 ef_fresnel(float cosTheta, vec3 f0) {\r
  float m = clamp(1.0 - cosTheta, 0.0, 1.0);\r
  float m2 = m * m;\r
  return f0 + (1.0 - f0) * m2 * m2 * m;\r
}

vec3 ef_directLight(\r
    vec3 L, vec3 colour, float illuminance,\r
    vec3 N, vec3 V, vec3 albedo, vec3 f0, float roughness) {\r
  if (illuminance <= 0.0) return vec3(0.0);

  float nDotL = dot(N, L);\r
  if (nDotL <= 0.0) return vec3(0.0);

  float horizon = smoothstep(-0.035, 0.02, L.y);\r
  if (horizon <= 0.0) return vec3(0.0);

  float nDotV = max(1e-3, dot(N, V));\r
  vec3 H = normalize(L + V);\r
  float nDotH = max(0.0, dot(N, H));

  float D = ef_ggx(nDotH, roughness);\r
  float G = ef_smith(nDotV, nDotL, roughness);\r
  vec3 F = ef_fresnel(max(0.0, dot(H, V)), f0);\r
  vec3 specular = (D * G / (4.0 * nDotV * nDotL + EPS)) * F;

  return colour * illuminance * nDotL * horizon * (albedo * INV_PI * (1.0 - F) + specular);\r
}

vec3 ef_shadeSurface(vec3 albedo, vec3 N, vec3 V, float roughness, float occlusion, vec3 f0) {\r
  vec3 colour = vec3(0.0);\r
  colour += ef_directLight(uSunDirection, uSunColour, uSunIlluminance, N, V, albedo, f0, roughness);\r
  colour += ef_directLight(uMoonDirection, uMoonColour, uMoonIlluminance, N, V, albedo, f0, roughness);

  
  
  
  vec3 irradiance = textureCubeLodEXT(uEnvironment, N, 6.0).rgb * uEnvironmentIntensity;\r
  vec3 R = reflect(-V, N);\r
  vec3 reflection = textureCubeLodEXT(uEnvironment, R, roughness * 7.0).rgb * uEnvironmentIntensity;

  float nDotV = max(1e-3, dot(N, V));\r
  vec3 F = ef_fresnel(nDotV, f0);\r
  colour += albedo * irradiance * occlusion;\r
  colour += reflection * F * occlusion;

  return colour;\r
}

vec3 ef_aerialPerspective(vec3 colour, float distanceToCamera, vec3 V) {\r
  float extinction = 3.912 / max(200.0, uVisibility);\r
  float t = 1.0 - exp(-extinction * distanceToCamera);\r
  return mix(colour, ef_airLight(uEnvironment, uEnvironmentIntensity, V), t);\r
}

#endif

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vMaterial;
varying float vSway;
varying float vViewDistance;

uniform sampler2D uCaustics;

uniform float uCausticsScale;

uniform vec2 uCausticsOffset;
uniform float uCausticsPhase;

uniform float uCausticsStrength;

uniform float uWaterLevel;
uniform float uTurbidity;

const vec3 ABSORPTION_OCEANIC = vec3(0.42, 0.072, 0.028);
const vec3 ABSORPTION_COASTAL = vec3(0.56, 0.19, 0.31);
const vec3 SCATTER_OCEANIC = vec3(0.010, 0.038, 0.055);
const vec3 SCATTER_COASTAL = vec3(0.028, 0.062, 0.048);

const vec3 SEDIMENT_COLOUR = vec3(0.125, 0.118, 0.096);

const vec3 KELP_COLOUR = vec3(0.042, 0.055, 0.026);
const vec3 ROCK_COLOUR = vec3(0.058, 0.061, 0.063);

const vec3 STEEL_COLOUR = vec3(0.062, 0.042, 0.030);

float hashNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  vec4 h = vec4(
      dot(i, vec2(127.1, 311.7)),
      dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7)),
      dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7)),
      dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7)));
  vec4 r = fract(sin(h) * 43758.5453);
  return mix(mix(r.x, r.y, f.x), mix(r.z, r.w, f.x), f.y);
}

float submergedPath(vec3 fragPosition, vec3 eye, float level) {
  float fragBelow = max(0.0, level - fragPosition.y);
  float eyeBelow = max(0.0, level - eye.y);
  if (fragBelow <= 0.0 && eyeBelow <= 0.0) return 0.0;

  float total = distance(eye, fragPosition);
  if (fragBelow > 0.0 && eyeBelow > 0.0) return total;
  return total * ((fragBelow + eyeBelow) / max(EPS, abs(eye.y - fragPosition.y)));
}

void main() {
  
  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 V = (cameraPosition - vWorldPosition) / max(EPS, vViewDistance);

  vec3 albedo;
  float roughness;
  float occlusion = 1.0;

  if (vMaterial < 0.5) {
    
    
    
    float coarse = hashNoise(vWorldPosition.xz * 0.09);
    float fine = hashNoise(vWorldPosition.xz * 1.7);
    albedo = SEDIMENT_COLOUR * (0.72 + 0.5 * coarse) * (0.86 + 0.28 * fine);
    roughness = 0.94;
  } else if (vMaterial < 1.5) {
    
    albedo = KELP_COLOUR * (0.7 + 0.75 * vSway) * (0.85 + 0.3 * hashNoise(vUv * 8.0));
    roughness = 0.42;
    
    occlusion = 0.35 + 0.65 * vSway;
  } else if (vMaterial < 2.5) {
    float speckle = hashNoise(vWorldPosition.xz * 3.1 + vWorldPosition.y);
    albedo = ROCK_COLOUR * (0.7 + 0.7 * speckle);
    roughness = 0.86;
  } else {
    float corrosion = hashNoise(vWorldPosition.xz * 1.3 + vWorldPosition.y * 0.7);
    albedo = mix(STEEL_COLOUR, STEEL_COLOUR * 1.9, corrosion);
    
    
    roughness = 0.78;
    occlusion = 0.55 + 0.45 * (1.0 - max(0.0, N.y));
  }

  float depthBelow = max(0.0, uWaterLevel - vWorldPosition.y);
  vec3 absorption = mix(ABSORPTION_OCEANIC, ABSORPTION_COASTAL, uTurbidity);
  vec3 scatterColour = mix(SCATTER_OCEANIC, SCATTER_COASTAL, uTurbidity);

  
  
  
  
  
  
  vec2 causticUv = (vWorldPosition.xz + uCausticsOffset) / max(0.5, uCausticsScale);
  float phaseA = texture2D(uCaustics, causticUv).r;
  float phaseB = texture2D(uCaustics, causticUv * 1.11 + 0.37).g;
  float caustic = mix(phaseA, phaseB, uCausticsPhase);
  
  
  float reach = (1.0 - smoothstep(4.0, 32.0, depthBelow)) * max(0.0, N.y);
  float causticGain = 1.0 + caustic * uCausticsStrength * reach * 2.4;

  
  vec3 colour = ef_shadeSurface(albedo, N, V, roughness, occlusion, vec3(0.035));
  
  
  vec3 downwelling = exp(-absorption * (depthBelow / 0.66));
  colour *= downwelling * causticGain;

  
  float path = submergedPath(vWorldPosition, cameraPosition, uWaterLevel);
  vec3 transmittance = exp(-absorption * path);
  vec3 skyAbove = textureCubeLodEXT(uEnvironment, vec3(0.0, 1.0, 0.0), 5.0).rgb * uEnvironmentIntensity;
  vec3 sunlight = uSunColour * uSunIlluminance + uMoonColour * uMoonIlluminance;
  vec3 inscatter =
      scatterColour * (skyAbove * 0.55 + sunlight * 0.35 * max(0.0, uSunDirection.y)) * downwelling;
  colour = colour * transmittance + inscatter * (1.0 - transmittance);

  
  
  
  colour = ef_aerialPerspective(colour, max(0.0, vViewDistance - path), V);

  gl_FragColor = vec4(hdrClamp(colour), 1.0);
}`,nf=-38,rf=22,af=24,of=6,sf=28,cf=.32,lf=96,uf=28,df=.022,ff=0,pf=1,mf=2,hf=3;function gf(e,t,n,r){return e*r+t/n*r}var _f=class{banks;gullies;ripples;constructor(e){this.banks=new mr(e^24235),this.gullies=new mr(e^38417),this.ripples=new mr(e^11271)}heightAt(e,t){let n=this.banks.fbm2(e*.0013,t*.0013,4)*rf,r=this.gullies.ridged2(e*9e-4,t*9e-4,3),i=r*r*af,a=this.ripples.fbm2(e*.035,t*.035,2)*.55;return nf+n-i+a}normalAt(e,t,n){let r=1.5,i=this.heightAt(e+r,t)-this.heightAt(e-r,t),a=this.heightAt(e,t+r)-this.heightAt(e,t-r);return n.set(-i,2*r,-a).normalize()}slopeAt(e,t){let n=1.5,r=this.heightAt(e+n,t)-this.heightAt(e-n,t),i=this.heightAt(e,t+n)-this.heightAt(e,t-n);return Math.hypot(r,i)/(2*n)}sampleChunk(e,t,n,r,i){let a=n+1;for(let o=0;o<=n;o+=1){let s=gf(t,o,n,r);for(let t=0;t<=n;t+=1){let c=gf(e,t,n,r);i[o*a+t]=this.heightAt(c,s)}}return i}};function vf(e,t,n=0){let r=e.getAttribute(`position`),i=new Float32Array(r.count),a=new Float32Array(r.count);for(let e=0;e<r.count;e+=1)a[e]=t,i[e]=n>0?G(r.getY(e)/n,0,1):0;return e.setAttribute(`aSway`,new j(i,1)),e.setAttribute(`aMaterial`,new j(a,1)),e}function yf(e){let t=e*.075,n=[],r=[],i=[];for(let a of[0,1]){let o=n.length/3;for(let i=0;i<=6;i+=1){let o=i/6,s=t*Math.sin(Math.PI*o**.62)*(1-.35*o);for(let t of[-1,1]){let i=t*s;n.push(a===0?i:0,o*e,a===0?0:i),r.push(t*.5+.5,o)}}for(let e=0;e<6;e+=1){let t=o+e*2;i.push(t,t+1,t+2,t+1,t+3,t+2)}}let a=new L;return a.setAttribute(`position`,new j(new Float32Array(n),3)),a.setAttribute(`uv`,new j(new Float32Array(r),2)),a.setIndex(i),a.computeVertexNormals(),vf(a,pf,e)}function bf(){let e=new l(1,1),t=e.getAttribute(`position`);for(let e=0;e<t.count;e+=1){let n=t.getX(e),r=t.getY(e),i=t.getZ(e),a=.78+.22*Math.sin(n*5.1+r*3.3)*Math.cos(i*4.7-r*2.1);t.setXYZ(e,n*a,r*a*.72,i*a)}return e.computeVertexNormals(),vf(e,mf)}function xf(){let e=[new R(4.6,3.2,13).translate(0,.4,-5.5),new R(4.4,3,9).rotateX(.16).rotateZ(.3).translate(.8,-.2,5.4),new F(2.3,1.2,4.4,8).rotateX(Math.PI/2).translate(0,.4,-13.4),new R(3.4,2.4,4.2).translate(0,2.9,-3.2),new F(.85,.95,2.6,10).translate(0,5.2,-2.4),new F(.22,.3,11,7).rotateZ(1.32).translate(3.4,1.9,-7.5),new R(4.8,.3,.35).translate(0,1.6,-1.2),new R(4.8,.3,.35).translate(0,1.5,.6)],t=Me(e,!1);for(let t of e)t.dispose();return t.translate(0,-1.4,0),vf(t,hf)}var Sf=new b,Cf=new t,wf=new P,Tf=new t,Ef=new t,Df=new t(0,1,0),Of=class{name=`seabed`;priority=12;chunkSize=128;field;root=new r;material;kelpGeometry;boulderGeometry;wreckGeometry;grid;swell;optics=null;kelpBudget;rockBudget;constructor(e,t){this.swell=t,this.field=new _f(e.settings.world.seed);let n=e.settings.graphics;this.kelpBudget=Math.round(lf*G(n.instanceDensity,.1,1)),this.rockBudget=Math.round(uf*G(n.instanceDensity,.1,1)),this.kelpGeometry=yf(1),this.boulderGeometry=bf(),this.wreckGeometry=xf(),this.material=new i({name:`seabed`,vertexShader:ef,fragmentShader:tf,uniforms:{...Oo(),uTime:{value:0},uCurrent:{value:new x(.06,.03)},uSurgeDirection:{value:new x(1,0)},uSurgeFrequency:{value:.8},uSurgeSpeed:{value:.2},uSwayScale:{value:.9},uCaustics:{value:null},uCausticsScale:{value:9},uCausticsOffset:{value:new x},uCausticsPhase:{value:0},uCausticsStrength:{value:0},uWaterLevel:{value:0},uTurbidity:{value:.32}},side:2}),this.grid=new $d(this,e.settings.world.seed^3053,{creationBudget:2,poolLimit:12}),this.grid.setDrawDistance(Af(n.drawDistance)),this.root.name=`seabed`,e.scene.add(this.root)}floorHeightAt(e,t){return this.field.heightAt(e,t)}setOptics(e){this.optics=e}update(e,t){let n=t.camera.position;this.grid.update(n.x,n.z);let r=this.material.uniforms;jf(r,`uTime`,t.loop.elapsed),jf(r,`uWaterLevel`,this.swell.heightAt(n.x,n.z));let i=Math.max(1,-this.field.heightAt(n.x,n.z)),a=0,o=0,s=.8,c=this.swell.waveBank.components;for(let e=0;e<c.length;e+=1){let t=c[e];if(t===void 0||t.amplitude<=a)continue;a=t.amplitude,s=t.frequency,o=t.amplitude*t.frequency*Math.exp(-t.wavenumber*i);let n=r.uSurgeDirection;n!==void 0&&n.value.set(t.directionX,t.directionZ)}jf(r,`uSurgeFrequency`,s),jf(r,`uSurgeSpeed`,Math.min(1.2,o));let l=r.uCurrent;if(l!==void 0){let e=t.world;l.value.set(e.windX*.012,e.windZ*.012)}}beforeRender(e){let t=this.material.uniforms;Ao(t,e,ko(e));let n=this.optics;if(n===null)return;let r=t.uCaustics;r!==void 0&&(r.value=n.caustics),jf(t,`uCausticsScale`,n.causticsScale),jf(t,`uCausticsPhase`,n.causticsPhase),jf(t,`uCausticsStrength`,n.causticsStrength),jf(t,`uTurbidity`,n.turbidity);let i=t.uCausticsOffset;i!==void 0&&i.value.set(n.causticsOffsetX,n.causticsOffsetZ)}onSettingsChanged(e){let t=e.settings.graphics;this.kelpBudget=Math.round(lf*G(t.instanceDensity,.1,1)),this.rockBudget=Math.round(uf*G(t.instanceDensity,.1,1)),this.grid.setDrawDistance(Af(t.drawDistance))}dispose(){this.grid.dispose(),this.material.dispose(),this.kelpGeometry.dispose(),this.boulderGeometry.dispose(),this.wreckGeometry.dispose(),this.root.clear()}create(t,n,i){let a=kf(),o=new r,c=new e(a,this.material);c.receiveShadow=!0,o.add(c);let l=new s(this.kelpGeometry,this.material,lf);l.count=0,l.frustumCulled=!1,o.add(l);let u=new s(this.boulderGeometry,this.material,uf);u.count=0,u.frustumCulled=!1,o.add(u);let d=new e(this.wreckGeometry,this.material);d.visible=!1,o.add(d),this.root.add(o);let f={group:o,geometry:a,kelp:l,rocks:u,wreck:d};return this.fill(f,t,n,i),f}reset(e,t,n,r){this.fill(e,t,n,r)}retire(e){e.group.visible=!1}destroy(e){this.root.remove(e.group),e.geometry.dispose(),e.kelp.dispose(),e.rocks.dispose()}fill(e,t,n,r){let i=t*128,a=n*128;e.group.position.set(i,0,a),e.group.visible=!0;let o=e.geometry.getAttribute(`position`),s=e.geometry.getAttribute(`normal`),c=0;for(let e=0;e<=32;e+=1){let r=gf(n,e,32,128);for(let e=0;e<=32;e+=1){let n=gf(t,e,32,128);o.setY(c,this.field.heightAt(n,r)),this.field.normalAt(n,r,Ef),s.setXYZ(c,Ef.x,Ef.y,Ef.z),c+=1}}o.needsUpdate=!0,s.needsUpdate=!0,e.geometry.computeBoundingSphere(),this.scatterKelp(e,i,a,r),this.scatterRocks(e,i,a,r),this.placeWreck(e,i,a,r)}scatterKelp(e,t,n,r){let i=0;for(let a=0;a<this.kelpBudget;a+=1){let a=r.next()*128,o=r.next()*128,s=t+a,c=n+o,l=this.field.heightAt(s,c),u=-l;if(u<of||u>sf||this.field.slopeAt(s,c)>cf)continue;let d=1.1+2.4*G((u-of)/16,0,1)*r.range(.7,1.3);Cf.set(a,l,o),wf.setFromAxisAngle(Df,r.next()*Math.PI*2),Tf.set(r.range(.75,1.25),d,r.range(.75,1.25)),Sf.compose(Cf,wf,Tf),e.kelp.setMatrixAt(i,Sf),i+=1}e.kelp.count=i,e.kelp.visible=i>0,e.kelp.instanceMatrix.needsUpdate=!0}scatterRocks(e,t,n,r){let i=0;for(let a=0;a<this.rockBudget;a+=1){let a=r.next()*128,o=r.next()*128,s=t+a,c=n+o,l=this.field.slopeAt(s,c);if(r.next()>.15+l*2.2)continue;let u=this.field.heightAt(s,c),d=r.range(.35,1.9);Cf.set(a,u-d*.3,o),wf.setFromAxisAngle(Ef.set(r.range(-1,1),r.range(-1,1),r.range(-1,1)).normalize(),r.next()*Math.PI*2),Tf.set(d*r.range(.8,1.3),d,d*r.range(.8,1.3)),Sf.compose(Cf,wf,Tf),e.rocks.setMatrixAt(i,Sf),i+=1}e.rocks.count=i,e.rocks.visible=i>0,e.rocks.instanceMatrix.needsUpdate=!0}placeWreck(e,t,n,r){let i=e.wreck;if(r.next()>df){i.visible=!1;return}let a=r.range(20,108),o=r.range(20,108),s=this.field.heightAt(t+a,n+o);i.visible=!0,i.position.set(a,s,o),i.rotation.set(r.range(-.12,.12),r.next()*Math.PI*2,r.range(.15,.42))}};function kf(){let e=1089,t=new Float32Array(e*3),n=new Float32Array(e*3),r=new Float32Array(e*2),i=new Float32Array(e),a=new Float32Array(e),o=new Uint16Array(6144),s=0;for(let e=0;e<=32;e+=1)for(let o=0;o<=32;o+=1)t[s*3]=o/32*128,t[s*3+2]=e/32*128,n[s*3+1]=1,r[s*2]=o/32,r[s*2+1]=e/32,i[s]=0,a[s]=ff,s+=1;let c=0;for(let e=0;e<32;e+=1)for(let t=0;t<32;t+=1){let n=e*33+t;o[c]=n,o[c+1]=n+33,o[c+2]=n+1,o[c+3]=n+1,o[c+4]=n+33,o[c+5]=n+33+1,c+=6}let l=new L;return l.setAttribute(`position`,new j(t,3)),l.setAttribute(`normal`,new j(n,3)),l.setAttribute(`uv`,new j(r,2)),l.setAttribute(`aSway`,new j(i,1)),l.setAttribute(`aMaterial`,new j(a,1)),l.setIndex(new j(o,1)),l}function Af(e){return G(e*.07,200,300)}function jf(e,t,n){let r=e[t];r!==void 0&&(r.value=n)}var Mf=[.42,.072,.028],Nf=[.56,.19,.31],Pf=[.01,.038,.055],Ff=[.028,.062,.048],If=1.333,Lf=.66,Rf=1500,zf=22,Bf=700,Vf=11,Hf=34,Uf=new t,Wf=new t(0,-1,0),Gf=class{name=`underwater`;priority=35;caustics;causticsStrength=0;causticsScale=9;causticsOffsetX=0;causticsOffsetZ=0;causticsPhase=0;turbidity=.34;swell;murk;murkMaterial;murkGeometry;motes;moteMaterial;moteGeometry;moteSprite;moteData;moteDrift;shafts;shaftMesh;shaftMaterial;shaftGeometry;waterColour=new a;surfaceY=0;cameraY=0;submersionAmount=0;moteCount=0;godRaysEnabled;constructor(t,n){this.swell=n;let i=t.settings.graphics;this.godRaysEnabled=i.godRaysEnabled,this.caustics=t.resources.track(Br(256,t.settings.world.seed^51717)),this.murkGeometry=new u(Rf,16,12),this.murkMaterial=new ie({side:1,depthTest:!1,depthWrite:!0,fog:!1,toneMapped:!1}),this.murk=new e(this.murkGeometry,this.murkMaterial),this.murk.name=`underwater:murk`,this.murk.renderOrder=-500,this.murk.frustumCulled=!1,this.murk.visible=!1,t.scene.add(this.murk);let a=new H(t.settings.world.seed^16135);this.moteData=new Float32Array(Bf*3),this.moteDrift=new Float32Array(Bf*3);for(let e=0;e<Bf;e+=1)this.moteData[e*3]=a.range(-22,zf)*.5,this.moteData[e*3+1]=a.range(-22,zf)*.5,this.moteData[e*3+2]=a.range(-22,zf)*.5,this.moteDrift[e*3]=a.range(-.05,.05),this.moteDrift[e*3+1]=a.range(-.03,-.004),this.moteDrift[e*3+2]=a.range(-.05,.05);this.moteGeometry=new L,this.moteGeometry.setAttribute(`position`,new j(this.moteData,3)),this.moteSprite=t.resources.track(Jf()),this.moteMaterial=new Ee({map:this.moteSprite,size:.045,sizeAttenuation:!0,transparent:!0,depthWrite:!1,toneMapped:!1}),this.motes=new fe(this.moteGeometry,this.moteMaterial),this.motes.name=`underwater:motes`,this.motes.frustumCulled=!1,this.motes.visible=!1,this.motes.renderOrder=5,t.scene.add(this.motes),this.shaftGeometry=Yf(a),this.shaftMaterial=new ie({vertexColors:!0,transparent:!0,blending:2,depthWrite:!1,side:2,fog:!1,toneMapped:!1}),this.shaftMesh=new e(this.shaftGeometry,this.shaftMaterial),this.shaftMesh.frustumCulled=!1,this.shaftMesh.renderOrder=4,this.shafts=new r,this.shafts.name=`underwater:shafts`,this.shafts.add(this.shaftMesh),this.shafts.visible=!1,t.scene.add(this.shafts),this.applyDensity(i.instanceDensity)}get isSubmerged(){return this.submersionAmount>.5}get submersion(){return this.submersionAmount}get depthM(){return Math.max(0,this.surfaceY-this.cameraY)}get waterRadiance(){return this.waterColour}update(e,t){let n=t.camera.position,r=t.world;this.surfaceY=this.swell.heightAt(n.x,n.z),this.cameraY=n.y,this.submersionAmount=G((this.surfaceY-n.y)/.35,0,1),this.updateCaustics(t,r.cloudiness),this.updateWaterColour(r.sceneIlluminanceLux);let i=this.submersionAmount>.5;this.murk.visible=i,this.motes.visible=i,this.shafts.visible=i&&this.godRaysEnabled&&this.causticsStrength>.02,i&&(this.murk.position.copy(n),this.murkMaterial.color.copy(this.waterColour),this.updateMotes(e,n),this.shafts.visible&&this.updateShafts(t,n))}onSettingsChanged(e){let t=e.settings.graphics;this.godRaysEnabled=t.godRaysEnabled,this.applyDensity(t.instanceDensity)}dispose(){this.murkGeometry.dispose(),this.murkMaterial.dispose(),this.moteGeometry.dispose(),this.moteMaterial.dispose(),this.shaftGeometry.dispose(),this.shaftMaterial.dispose()}applyDensity(e){this.moteCount=Math.round(Bf*G(e,.15,1)),this.moteGeometry.setDrawRange(0,this.moteCount)}updateCaustics(e,t){let n=this.swell.waveBank.components,r=0,i=1,a=0,o=3;for(let e=0;e<n.length;e+=1){let t=n[e];t===void 0||t.amplitude<=r||(r=t.amplitude,i=t.directionX,a=t.directionZ,o=t.frequency/Math.max(1e-4,t.wavenumber))}let s=e.loop.elapsed,c=o*.25*s;this.causticsOffsetX=i*c,this.causticsOffsetZ=a*c,this.causticsPhase=.5+.5*Math.sin(s*Math.PI*2/this.swell.waveBank.peakPeriod);let l=e.world.ephemeris,u=l===null?0:l.sunDirectionRefracted.y;this.causticsStrength=G(u*2.2,0,1)*(1-G(t,0,1)*.9)}updateWaterColour(e){let t=e/Math.PI,n=Math.max(0,this.surfaceY-this.cameraY);this.waterColour.setRGB(qf(0,this.turbidity,t,n),qf(1,this.turbidity,t,n),qf(2,this.turbidity,t,n))}updateMotes(e,t){let n=this.moteData,r=this.moteDrift,i=zf,a=i*.5;for(let t=0;t<this.moteCount;t+=1){let o=t*3,s=(n[o]??0)+(r[o]??0)*e,c=(n[o+1]??0)+(r[o+1]??0)*e,l=(n[o+2]??0)+(r[o+2]??0)*e;s>a?s-=i:s<-11&&(s+=i),c>a?c-=i:c<-11&&(c+=i),l>a?l-=i:l<-11&&(l+=i),n[o]=s,n[o+1]=c,n[o+2]=l}this.moteGeometry.getAttribute(`position`).needsUpdate=!0,this.motes.position.copy(t),this.moteMaterial.color.copy(this.waterColour).multiplyScalar(2.6),this.moteMaterial.opacity=.34*this.submersionAmount}updateShafts(e,t){let n=e.world.ephemeris;if(this.shafts.position.set(t.x,this.surfaceY,t.z),n!==null){let e=n.sunDirectionRefracted,t=Math.hypot(e.x,e.z),r=Math.atan2(t,Math.max(0,e.y)),i=Math.asin(G(Math.sin(r)/If,-1,1)),a=t<1e-5?0:Math.sin(i)/t;Uf.set(-e.x*a,-Math.cos(i),-e.z*a).normalize(),this.shafts.quaternion.setFromUnitVectors(Wf,Uf)}this.shaftMaterial.opacity=.5*this.causticsStrength*this.submersionAmount,this.shaftMaterial.color.setRGB(this.waterColour.r*6+.02,this.waterColour.g*5+.05,this.waterColour.b*4.5+.05)}};function Kf(e,t,n,r){let i=e[n]??0;return i+((t[n]??0)-i)*r}function qf(e,t,n,r){let i=Kf(Mf,Nf,e,t);return Kf(Pf,Ff,e,t)*n*.55*Math.exp(-i*r/Lf)}function Jf(e=32){let t=new Uint8Array(e*e*4),n=(e-1)*.5;for(let r=0;r<e;r+=1)for(let i=0;i<e;i+=1){let a=(i-n)/n,o=(r-n)/n,s=Math.exp(-(a*a+o*o)*4.2),c=(r*e+i)*4;t[c]=255,t[c+1]=255,t[c+2]=255,t[c+3]=Math.round(Math.min(1,s)*255)}let r=new _(t,e,e,se,f);return r.minFilter=I,r.magFilter=I,r.needsUpdate=!0,r}function Yf(e){let t=[],n=[],r=[];for(let i=0;i<Vf;i+=1){let a=i/Vf*Math.PI*2+e.range(-.2,.2),o=e.range(1.5,9),s=e.range(.35,1.5),c=Hf*e.range(.55,1),l=Math.cos(a)*o,u=Math.sin(a)*o,d=-Math.sin(a),f=Math.cos(a),p=t.length/3;for(let e=0;e<=1;e+=1){let r=-c*e,i=1+e*.7,a=+(e===0);for(let e=-1;e<=1;e+=1){let o=e*s*i;t.push(l+d*o,r,u+f*o);let c=+(e===0);n.push(c*a,c*a,c*a)}}for(let e=0;e<2;e+=1){let t=p+e;r.push(t,t+1,t+4,t,t+4,t+3)}}let i=new L;return i.setAttribute(`position`,new j(new Float32Array(t),3)),i.setAttribute(`color`,new j(new Float32Array(n),3)),i.setIndex(r),i}var Xf=1024,Zf=420,Qf=150,$f=.3,ep=.34,tp=2.2,np=2.6,rp=1382989,ip=8318545,ap=10290206,op=35e-5,sp=.0016,cp=4096;function lp(){return{dx:0,dz:0}}function up(){return{min:0,max:0}}function dp(e,t){return e*8388608+t}var fp=class{seed;relief;coast;detail;islands=new Map;constructor(e){this.seed=e>>>0,this.relief=new mr(this.seed^20973),this.coast=new mr(this.seed^49317),this.detail=new mr(this.seed^54138)}islandAt(e,t){let n=dp(e,t),r=this.islands.get(n);if(r!==void 0)return r;this.islands.size>=cp&&this.islands.clear();let i=H.deriveStream(this.seed^rp,e,t),a=null;if(i.bool(ep)){let n=(e+.5+i.range(-.3,$f))*Xf,r=(t+.5+i.range(-.3,$f))*Xf,o=i.range(.42,.58);a={cellX:e,cellZ:t,centreX:n,centreZ:r,radius:i.range(Qf,Zf),height:i.range(9,96),beachInner:o,beachOuter:o+i.range(.2,.34),massifEdge:i.range(.45,.88),ruggedness:i.range(.2,.95),ridgeFrequency:i.range(.0045,.011),noiseX:i.range(-6e3,6e3),noiseZ:i.range(-6e3,6e3)}}return this.islands.set(n,a),a}seabedAt(e,t){return-55+this.relief.fbm2(e*op,t*op,4)*11}heightAt(e,t){let n=this.seabedAt(e,t),r=Math.floor(e/Xf),i=Math.floor(t/Xf),a=0;for(let o=-1;o<=1;o+=1)for(let s=-1;s<=1;s+=1){let c=this.islandAt(r+s,i+o);if(c===null)continue;let l=this.liftAt(c,e,t,-n);l>a&&(a=l)}return n+a}depthAt(e,t){return Math.max(0,-this.heightAt(e,t))}gradientAt(e,t,n){let r=1.5;return n.dx=(this.heightAt(e+r,t)-this.heightAt(e-r,t))/(2*r),n.dz=(this.heightAt(e,t+r)-this.heightAt(e,t-r))/(2*r),n}liftAt(e,t,n,r){let i=t-e.centreX,a=n-e.centreZ,o=i*i+a*a;if(o>=e.radius*e.radius)return 0;let s=Math.sqrt(o)/e.radius,c=this.coast.fbm2((t+e.noiseX)*sp,(n+e.noiseZ)*sp,3),l=G(e.beachInner+c*.11,.28,.86),u=G(e.beachOuter+c*.08,l+.06,.96),d=W(1,u,s),f=d*(2-d),p=W(u,l,s),m=r-np,h=this.detail.fbm2((t+e.noiseX)*.011,(n+e.noiseZ)*.011,2),g=r+tp+h*1,_=f*m+p*(g-m),v=G(e.massifEdge*l+c*.09,.06,l-.03),y=W(v,v*.2,s);if(y<=0)return _;let b=(t+e.noiseX)*e.ridgeFrequency,x=(n+e.noiseZ)*e.ridgeFrequency,S=this.relief.ridged2(b,x,5),C=hr(this.detail.fbm2(b,x,4)*.5+.5,S,e.ruggedness);return _+y*y*e.height*C}chunkPeak(e,t){let n=-1/0;for(let r=0;r<=4;r+=1)for(let i=0;i<=4;i+=1){let a=this.heightAt(e*256+i*64,t*256+r*64);a>n&&(n=a)}return n}sampleChunkGrid(e,t,n,r,i){let a=256/n,o=n+3,s=e*n-1,c=t*n-1,l=1/0,u=-1/0;for(let e=0;e<o;e+=1){let t=(c+e)*a,n=e*o;for(let e=0;e<o;e+=1){let i=this.heightAt((s+e)*a,t);r[n+e]=i,i<l&&(l=i),i>u&&(u=i)}}i.min=l,i.max=u}};function pp(e,t,n,r,i,a){let o=256/t,s=t+3,c=G((i-n*256)/o+1,0,s-1.0001),l=G((a-r*256)/o+1,0,s-1.0001),u=Math.floor(c),d=Math.floor(l),f=c-u,p=l-d,m=d*s+u,h=e[m]??0,g=e[m+1]??0,_=e[m+s]??0,v=e[m+s+1]??0;return hr(hr(h,g,f),hr(_,v,f),p)}function mp(e,t,n,r,i,a){let o=256/t,s=pp(e,t,n,r,i+o,a),c=pp(e,t,n,r,i-o,a),l=pp(e,t,n,r,i,a-o),u=pp(e,t,n,r,i,a+o);return Math.hypot((s-c)/(2*o),(u-l)/(2*o))}var hp=10,gp=32,_p=1024,vp=3.4,yp=1.6,bp=.7,xp=.95;function Sp(){return{cx:0,cz:0,treeCount:0,grassCount:0,trees:new Float32Array(600),grass:new Float32Array(_p*5)}}function Cp(e,t,n,r,i,a){a.cx=t,a.cz=n,a.treeCount=0,a.grassCount=0;let o=H.deriveStream(e.seed^ip,t,n),s=t*256,c=n*256,l=256/hp;for(let e=0;e<hp;e+=1)for(let u=0;u<hp;u+=1){let d=s+(u+o.next())*l,f=c+(e+o.next())*l,p=pp(r,i,t,n,d,f);if(p<vp||mp(r,i,t,n,d,f)>bp||!o.bool(G(1.25-p/70,.06,.9)))continue;let m=a.treeCount*6;a.trees[m]=d,a.trees[m+1]=p,a.trees[m+2]=f,a.trees[m+3]=o.range(0,Math.PI*2),a.trees[m+4]=o.range(.62,1.35),a.trees[m+5]=o.int(0,1),a.treeCount+=1}let u=256/gp;for(let e=0;e<gp;e+=1)for(let l=0;l<gp;l+=1){let d=s+(l+o.next())*u,f=c+(e+o.next())*u,p=pp(r,i,t,n,d,f);if(p<yp||mp(r,i,t,n,d,f)>xp)continue;let m=a.grassCount*5;a.grass[m]=d,a.grass[m+1]=p,a.grass[m+2]=f,a.grass[m+3]=o.range(0,Math.PI*2),a.grass[m+4]=o.range(.7,1.4),a.grassCount+=1}}var wp=[`lighthouse`,`buoy`,`jetty`,`wreck`,`arch`,`crate`,`bottle`];function Tp(){return{cx:0,cz:0,count:0,data:new Float32Array(96)}}function Ep(e,t,n,r){r.cx=t,r.cz=n,r.count=0;let i=H.deriveStream(e.seed^ap,t,n),a=lp();for(let o=0;o<14&&r.count<12;o+=1){let o=(t+i.next())*512,s=(n+i.next())*512,c=e.heightAt(o,s);e.gradientAt(o,s,a);let l=Math.hypot(a.dx,a.dz),u=Math.atan2(-a.dx,-a.dz),d=null,f=c;if(c>9&&c<70&&l<.5&&i.bool(.22)?d=`lighthouse`:c>6&&l>.9&&i.bool(.45)?(d=`arch`,f=0):c>-.6&&c<1.4&&l<.16&&i.bool(.35)?(d=`jetty`,f=0):c>-4.5&&c<-1&&i.bool(.2)?(d=`wreck`,f=c):c<-8&&c>-48&&i.bool(.45)?(d=`buoy`,f=0):c<-3&&i.bool(.04)&&(d=i.bool(.6)?`crate`:`bottle`,f=0),d===null)continue;let p=r.count*8;r.data[p]=wp.indexOf(d),r.data[p+1]=o,r.data[p+2]=f,r.data[p+3]=s,r.data[p+4]=d===`jetty`||d===`arch`?u:i.range(0,Math.PI*2),r.data[p+5]=i.range(.8,1.25),r.data[p+6]=i.next(),r.data[p+7]=i.range(0,Math.PI*2),r.count+=1}}function Dp(e){let t=e+1,n=t*t,r=[];for(let n=0;n<e;n+=1)for(let i=0;i<e;i+=1){let e=n*t+i,a=e+1,o=e+t,s=o+1;r.push(e,o,a,a,o,s)}let i=Op(e);for(let e=0;e<i.length;e+=1){let t=i[e]??0,a=i[(e+1)%i.length]??0,o=n+e,s=n+(e+1)%i.length;r.push(t,a,o,a,s,o)}return new j(new Uint32Array(r),1)}function Op(e){let t=e+1,n=[];for(let t=0;t<e;t+=1)n.push(t);for(let r=0;r<e;r+=1)n.push(r*t+e);for(let r=e;r>0;--r)n.push(e*t+r);for(let r=e;r>0;--r)n.push(r*t);return new Int32Array(n)}function kp(t,n,r){let i=Op(t),a=t+1,o=a*a+i.length,s=new Float32Array(o*3),c=new Float32Array(o*3),l=new L;l.setAttribute(`position`,new j(s,3)),l.setAttribute(`normal`,new j(c,3)),n!==void 0&&l.setIndex(n),l.boundingSphere=new D;let u=new e(l,r);return u.matrixAutoUpdate=!1,{segments:t,geometry:l,mesh:u,position:s,normal:c,ring:i}}function Ap(e,t,n,r){let i=e.segments+1,a=n+3,o=n/e.segments,s=256/e.segments,c=256/n;for(let n=0;n<i;n+=1){let r=n*o+1;for(let l=0;l<i;l+=1){let u=l*o+1,d=r*a+u,f=((t[d+1]??0)-(t[d-1]??0))/(2*c),p=((t[d+a]??0)-(t[d-a]??0))/(2*c),m=1/Math.sqrt(f*f+1+p*p),h=(n*i+l)*3;e.position[h]=l*s-128,e.position[h+1]=t[d]??0,e.position[h+2]=n*s-128,e.normal[h]=-f*m,e.normal[h+1]=m,e.normal[h+2]=-p*m}}let l=i*i;for(let t=0;t<e.ring.length;t+=1){let n=(e.ring[t]??0)*3,r=(l+t)*3;e.position[r]=e.position[n]??0,e.position[r+1]=(e.position[n+1]??0)-14,e.position[r+2]=e.position[n+2]??0,e.normal[r]=e.normal[n]??0,e.normal[r+1]=e.normal[n+1]??1,e.normal[r+2]=e.normal[n+2]??0}e.geometry.getAttribute(`position`).needsUpdate=!0,e.geometry.getAttribute(`normal`).needsUpdate=!0;let u=e.geometry.boundingSphere;u!==null&&(u.center.set(0,(r.min+r.max)/2,0),u.radius=Math.hypot(128,128)+(r.max-r.min)/2+14)}var jp=Math.PI*(3-Math.sqrt(5)),Mp=new t(0,1,0),Np=new t(1,0,0),Pp=[{height:7.4,radius:.19,divisions:2,children:3,spread:.7,taper:.62,sweep:.16,cardsPerTip:3,cardSize:.8,trunkSides:6},{height:3.1,radius:.12,divisions:2,children:3,spread:1,taper:.68,sweep:.3,cardsPerTip:4,cardSize:.58,trunkSides:5}],Fp=.66,Ip=.42;function Lp(){return{position:[],normal:[],uv:[],index:[],phase:[],stiffness:[],tint:[]}}function Rp(e,t){let n=new L;return n.setAttribute(`position`,new j(new Float32Array(e.position),3)),n.setAttribute(`normal`,new j(new Float32Array(e.normal),3)),n.setAttribute(`uv`,new j(new Float32Array(e.uv),2)),t?(n.setAttribute(`aPhase`,new j(new Float32Array(e.phase),1)),n.setAttribute(`aStiffness`,new j(new Float32Array(e.stiffness),1))):n.setAttribute(`aTint`,new j(new Float32Array(e.tint),3)),n.setIndex(e.index),n.computeBoundingSphere(),n}function zp(e,t,n){let r=Math.abs(e.y)>.95?Np:Mp;t.copy(r).cross(e).normalize(),n.copy(e).cross(t).normalize()}function Bp(e,n,r,i,a,o,s,c,l){let u=new t().copy(r).sub(n).normalize(),d=new t,f=new t;zp(u,d,f);let p=e.position.length/3;for(let t=0;t<2;t+=1){let u=t===0?n:r,p=t===0?i:a,m=t===0?s:c,h=Fp+Ip*l;for(let t=0;t<=o;t+=1){let n=t/o*Math.PI*2,r=Math.cos(n),i=Math.sin(n),a=d.x*r+f.x*i,s=d.y*r+f.y*i,c=d.z*r+f.z*i;e.position.push(u.x+a*p,u.y+s*p,u.z+c*p),e.normal.push(a,s,c),e.uv.push(t/o,m),e.tint.push(h,h*.99,h*.94)}}let m=o+1;for(let t=0;t<o;t+=1){let n=p+t,r=n+1,i=n+m,a=i+1;e.index.push(n,r,i,r,a,i)}}function Vp(e,n,r,i,a,o,s){let c=new t,l=new t;zp(r,c,l);let u=Math.cos(a),d=Math.sin(a),f=new t().copy(c).multiplyScalar(u).addScaledVector(l,d),p=new t().copy(l).multiplyScalar(u).addScaledVector(c,-d).normalize(),m=i*.5,h=e.position.length/3;for(let t=0;t<4;t+=1){let a=t<2?0:1,c=t===0||t===3?-1:1;e.position.push(n.x+r.x*i*a+f.x*m*c,n.y+r.y*i*a+f.y*m*c,n.z+r.z*i*a+f.z*m*c),e.normal.push(p.x,p.y,p.z),e.uv.push(c*.5+.5,a),e.phase.push(o),e.stiffness.push(s)}e.index.push(h,h+1,h+2,h,h+2,h+3)}function Hp(e,n,r,i,a,o,s,c,l,u){let d=l===i.divisions?i.trunkSides:4,f=s/3,p=new t;zp(o,p,new t),p.multiplyScalar(i.sweep*f*r.range(-1,1));let m=a.clone(),h=new t,g=o.clone(),_=u,v=1-l/(i.divisions+1);for(let t=0;t<3;t+=1){let n=c*(1-t/3*.78),r=c*(1-.78*((t+1)/3));h.copy(m).addScaledVector(g,f).add(p),Bp(e,m,h,Math.max(n,.008),Math.max(r,.006),d,_,_+f,v),_+=f,m.copy(h),g.add(p).normalize()}if(l<=0){for(let e=0;e<i.cardsPerTip;e+=1)Vp(n,m,g,i.cardSize*r.range(.75,1.25),e*jp+r.range(-.3,.3),r.range(0,Math.PI*2),r.range(.22,.45));return}let y=new t,b=new t;zp(g,y,b);for(let a=0;a<i.children;a+=1){let o=a*jp+r.range(-.2,.2),u=i.spread*r.range(.75,1.25);Hp(e,n,r,i,m,new t().copy(g).multiplyScalar(Math.cos(u)).addScaledVector(y,Math.sin(u)*Math.cos(o)).addScaledVector(b,Math.sin(u)*Math.sin(o)).normalize(),s*i.taper*r.range(.85,1.15),c*.55,l-1,_)}}function Up(e,n){let r=Pp[e]??Pp[0];if(r===void 0)throw Error(`Vegetation: no species profiles are defined`);let i=new H(n),a=Lp(),o=Lp(),s=i.range(.06,.2),c=i.range(0,Math.PI*2),l=new t(Math.sin(c)*Math.sin(s),Math.cos(s),Math.cos(c)*Math.sin(s)).normalize();return Hp(a,o,i,r,new t(0,0,0),l,r.height,r.radius,r.divisions,0),{trunk:Rp(a,!1),canopy:Rp(o,!0)}}function Wp(e,t=5){let n=new H(e),r=Lp();for(let e=0;e<t;e+=1){let t=e*jp+n.range(-.4,.4),i=n.range(.26,.52),a=n.range(.014,.026),o=n.range(.18,.5),s=Math.cos(t),c=Math.sin(t),l=n.range(0,.09),u=n.range(0,Math.PI*2),d=n.range(.8,1.25),f=r.position.length/3;for(let e=0;e<=3;e+=1){let t=e/3,n=i*Math.sin(t*Math.PI*.5),f=l+o*i*t*t,p=a*(1-t*.92)/2;for(let e=0;e<2;e+=1){let i=e===0?-1:1;r.position.push(s*f-c*p*i,n,c*f+s*p*i),r.normal.push(s*.35,.94,c*.35),r.uv.push(e,t),r.phase.push(u),r.stiffness.push(d)}}for(let e=0;e<3;e+=1){let t=f+e*2;r.index.push(t,t+2,t+1,t+1,t+2,t+3)}}return Rp(r,!0)}var Gp=`precision highp float;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying float vViewDistance;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPosition = world.xyz;

  
  
  vNormal = normalize(normalMatrix * normal);
  vViewDistance = distance(world.xyz, cameraPosition);

  gl_Position = projectionMatrix * viewMatrix * world;
}`,Kp=`precision highp float;

#ifndef ENDLESS_FISHING_WORLDLIGHT\r
#define ENDLESS_FISHING_WORLDLIGHT

#ifndef ENDLESS_FISHING_CONSTANTS\r
#define ENDLESS_FISHING_CONSTANTS

const float PI = 3.14159265358979323846;\r
const float TWO_PI = 6.28318530717958647692;\r
const float HALF_PI = 1.57079632679489661923;\r
const float INV_PI = 0.31830988618379067154;\r
const float INV_FOUR_PI = 0.07957747154594766788;\r
const float DEG_TO_RAD = 0.01745329251994329577;\r
const float RAD_TO_DEG = 57.2957795130823208768;

const float EPS = 1e-6;

#ifndef saturate\r
float saturate(float x) { return clamp(x, 0.0, 1.0); }\r
vec2 saturate(vec2 x) { return clamp(x, 0.0, 1.0); }\r
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }\r
#endif

float ef_luminance(vec3 colour) {\r
  return dot(colour, vec3(0.2126, 0.7152, 0.0722));\r
}

float remap(float x, float lowIn, float highIn, float lowOut, float highOut) {\r
  float span = highIn - lowIn;\r
  float t = span == 0.0 ? step(lowIn, x) : (x - lowIn) / span;\r
  return lowOut + saturate(t) * (highOut - lowOut);\r
}

vec3 hdrClamp(vec3 colour) {\r
  vec3 safe;\r
  safe.x = colour.x == colour.x ? colour.x : 0.0;\r
  safe.y = colour.y == colour.y ? colour.y : 0.0;\r
  safe.z = colour.z == colour.z ? colour.z : 0.0;\r
  
  
  return clamp(safe, vec3(0.0), vec3(60000.0));\r
}

float hdrClampAlpha(float alpha) {\r
  return clamp(alpha == alpha ? alpha : 0.0, 0.0, 1.0);\r
}

#endif\r
#ifndef ENDLESS_FISHING_AIRLIGHT\r
#define ENDLESS_FISHING_AIRLIGHT

vec3 ef_airLight(samplerCube environment, float intensity, vec3 V) {\r
  vec3 direction = normalize(vec3(-V.x, max(-V.y, 0.07), -V.z) + vec3(EPS, 0.0, 0.0));\r
  return textureCubeLodEXT(environment, direction, 1.0).rgb * intensity;\r
}

#endif

uniform vec3 uSunDirection;\r
uniform vec3 uSunColour;

uniform float uSunIlluminance;\r
uniform vec3 uMoonDirection;\r
uniform vec3 uMoonColour;\r
uniform float uMoonIlluminance;

uniform samplerCube uEnvironment;\r
uniform float uEnvironmentIntensity;

uniform float uVisibility;

float ef_ggx(float nDotH, float roughness) {\r
  float a = roughness * roughness;\r
  float a2 = a * a;\r
  float d = nDotH * nDotH * (a2 - 1.0) + 1.0;\r
  return a2 / max(EPS, PI * d * d);\r
}

float ef_smith(float nDotV, float nDotL, float roughness) {\r
  float k = roughness * roughness * 0.5;\r
  return (nDotV / (nDotV * (1.0 - k) + k)) * (nDotL / (nDotL * (1.0 - k) + k));\r
}

vec3 ef_fresnel(float cosTheta, vec3 f0) {\r
  float m = clamp(1.0 - cosTheta, 0.0, 1.0);\r
  float m2 = m * m;\r
  return f0 + (1.0 - f0) * m2 * m2 * m;\r
}

vec3 ef_directLight(\r
    vec3 L, vec3 colour, float illuminance,\r
    vec3 N, vec3 V, vec3 albedo, vec3 f0, float roughness) {\r
  if (illuminance <= 0.0) return vec3(0.0);

  float nDotL = dot(N, L);\r
  if (nDotL <= 0.0) return vec3(0.0);

  float horizon = smoothstep(-0.035, 0.02, L.y);\r
  if (horizon <= 0.0) return vec3(0.0);

  float nDotV = max(1e-3, dot(N, V));\r
  vec3 H = normalize(L + V);\r
  float nDotH = max(0.0, dot(N, H));

  float D = ef_ggx(nDotH, roughness);\r
  float G = ef_smith(nDotV, nDotL, roughness);\r
  vec3 F = ef_fresnel(max(0.0, dot(H, V)), f0);\r
  vec3 specular = (D * G / (4.0 * nDotV * nDotL + EPS)) * F;

  return colour * illuminance * nDotL * horizon * (albedo * INV_PI * (1.0 - F) + specular);\r
}

vec3 ef_shadeSurface(vec3 albedo, vec3 N, vec3 V, float roughness, float occlusion, vec3 f0) {\r
  vec3 colour = vec3(0.0);\r
  colour += ef_directLight(uSunDirection, uSunColour, uSunIlluminance, N, V, albedo, f0, roughness);\r
  colour += ef_directLight(uMoonDirection, uMoonColour, uMoonIlluminance, N, V, albedo, f0, roughness);

  
  
  
  vec3 irradiance = textureCubeLodEXT(uEnvironment, N, 6.0).rgb * uEnvironmentIntensity;\r
  vec3 R = reflect(-V, N);\r
  vec3 reflection = textureCubeLodEXT(uEnvironment, R, roughness * 7.0).rgb * uEnvironmentIntensity;

  float nDotV = max(1e-3, dot(N, V));\r
  vec3 F = ef_fresnel(nDotV, f0);\r
  colour += albedo * irradiance * occlusion;\r
  colour += reflection * F * occlusion;

  return colour;\r
}

vec3 ef_aerialPerspective(vec3 colour, float distanceToCamera, vec3 V) {\r
  float extinction = 3.912 / max(200.0, uVisibility);\r
  float t = 1.0 - exp(-extinction * distanceToCamera);\r
  return mix(colour, ef_airLight(uEnvironment, uEnvironmentIntensity, V), t);\r
}

#endif

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying float vViewDistance;

uniform sampler2D uSandAlbedo;
uniform sampler2D uSandNormal;
uniform sampler2D uSandOrm;
uniform sampler2D uRockAlbedo;
uniform sampler2D uRockNormal;
uniform sampler2D uRockOrm;

uniform float uTideHeight;

uniform float uHighWaterMark;
uniform float uLowWaterMark;
uniform float uTime;

const float SAND_SCALE = 0.28;
const float ROCK_SCALE = 0.11;

const vec3 SAND_TINT = vec3(0.82, 0.80, 0.74);

const vec3 TURF_COLOUR = vec3(0.098, 0.116, 0.068);

vec4 triplanar(sampler2D tex, vec3 position, vec3 weights, float scale) {
  vec4 x = texture2D(tex, position.zy * scale);
  vec4 y = texture2D(tex, position.xz * scale);
  vec4 z = texture2D(tex, position.xy * scale);
  return x * weights.x + y * weights.y + z * weights.z;
}

vec3 applyPlanarNormal(vec3 geometric, vec3 packed, float strength) {
  vec3 tangentNormal = packed * 2.0 - 1.0;
  vec3 slope = vec3(tangentNormal.x, 0.0, tangentNormal.y) * strength;
  return normalize(geometric + slope);
}

void main() {
  vec3 viewVector = cameraPosition - vWorldPosition;
  vec3 V = viewVector / max(EPS, vViewDistance);
  vec3 geometric = normalize(vNormal);

  
  float aboveWater = vWorldPosition.y - uTideHeight;
  float slope = 1.0 - clamp(geometric.y, 0.0, 1.0);
  float rockMask = smoothstep(0.24, 0.52, slope);

  
  
  
  float turfMask = smoothstep(uHighWaterMark + 0.3, uHighWaterMark + 1.8, vWorldPosition.y);
  turfMask *= 1.0 - rockMask;

  
  vec3 weights = abs(geometric);
  weights = weights / max(EPS, weights.x + weights.y + weights.z);

  vec2 sandUv = vWorldPosition.xz * SAND_SCALE;
  vec3 sandAlbedo = texture2D(uSandAlbedo, sandUv).rgb * SAND_TINT;
  vec3 sandOrm = texture2D(uSandOrm, sandUv).rgb;
  vec3 sandNormal = texture2D(uSandNormal, sandUv).rgb;

  vec3 rockAlbedo = triplanar(uRockAlbedo, vWorldPosition, weights, ROCK_SCALE).rgb;
  vec3 rockOrm = triplanar(uRockOrm, vWorldPosition, weights, ROCK_SCALE).rgb;
  vec3 rockNormal = triplanar(uRockNormal, vWorldPosition, weights, ROCK_SCALE).rgb;

  
  
  float grain = ef_luminance(texture2D(uSandAlbedo, sandUv * 2.7).rgb);
  vec3 turfAlbedo = TURF_COLOUR * (0.55 + 0.9 * grain);

  vec3 albedo = mix(sandAlbedo, turfAlbedo, turfMask);
  albedo = mix(albedo, rockAlbedo, rockMask);

  float roughness = mix(mix(sandOrm.g, 0.92, turfMask), rockOrm.g, rockMask);
  float occlusion = mix(mix(sandOrm.r, sandOrm.r * 0.85, turfMask), rockOrm.r, rockMask);

  vec3 N = applyPlanarNormal(geometric, mix(sandNormal, rockNormal, rockMask), 1.0 - rockMask * 0.4);
  N = normalize(mix(N, geometric, smoothstep(120.0, 700.0, vViewDistance)));

  
  
  
  
  
  float dryingSpan = max(0.0, uHighWaterMark - uTideHeight);
  float wetness = 1.0 - smoothstep(0.0, 0.25 + dryingSpan * 0.9, aboveWater);
  wetness *= 1.0 - rockMask * 0.55;
  wetness *= 1.0 - turfMask;
  wetness = clamp(wetness, 0.0, 1.0);

  
  
  albedo *= mix(1.0, 0.42, wetness);
  albedo = mix(albedo, albedo * vec3(0.94, 1.0, 1.02), wetness);
  roughness = mix(roughness, 0.13, wetness * wetness);

  
  
  vec3 f0 = mix(vec3(0.035), vec3(0.02), rockMask);
  f0 = mix(f0, vec3(0.05), wetness);

  
  
  
  
  float sublittoral = 1.0 - smoothstep(uLowWaterMark - 0.9, uLowWaterMark + 0.2, vWorldPosition.y);
  albedo = mix(albedo, albedo * vec3(0.44, 0.62, 0.48), sublittoral * 0.85);
  roughness = mix(roughness, 0.55, sublittoral * 0.6);

  vec3 colour = ef_shadeSurface(albedo, N, V, clamp(roughness, 0.05, 1.0), occlusion, f0);

  
  
  
  
  
  float swashBand = 1.0 - smoothstep(0.0, 0.22, abs(aboveWater - 0.06));
  float breathe = 0.5 + 0.5 * sin(uTime * 0.7 + vWorldPosition.x * 0.05 + vWorldPosition.z * 0.037);
  float swash = swashBand * (0.35 + 0.65 * breathe) * (1.0 - rockMask * 0.7) * (1.0 - sublittoral);
  vec3 skyAbove = textureCubeLodEXT(uEnvironment, vec3(0.0, 1.0, 0.0), 5.0).rgb * uEnvironmentIntensity;
  vec3 foamColour = (skyAbove * 0.5 + uSunColour * uSunIlluminance * 0.18) * vec3(0.94, 0.96, 0.97);
  colour = mix(colour, foamColour, clamp(swash, 0.0, 0.75));

  
  
  
  float submerged = smoothstep(0.0, -1.6, aboveWater);
  colour *= mix(1.0, 0.45, submerged);

  colour = ef_aerialPerspective(colour, vViewDistance, V);

  gl_FragColor = vec4(hdrClamp(colour), 1.0);
}`,qp=`precision highp float;

#ifndef ENDLESS_FISHING_CONSTANTS\r
#define ENDLESS_FISHING_CONSTANTS

const float PI = 3.14159265358979323846;\r
const float TWO_PI = 6.28318530717958647692;\r
const float HALF_PI = 1.57079632679489661923;\r
const float INV_PI = 0.31830988618379067154;\r
const float INV_FOUR_PI = 0.07957747154594766788;\r
const float DEG_TO_RAD = 0.01745329251994329577;\r
const float RAD_TO_DEG = 57.2957795130823208768;

const float EPS = 1e-6;

#ifndef saturate\r
float saturate(float x) { return clamp(x, 0.0, 1.0); }\r
vec2 saturate(vec2 x) { return clamp(x, 0.0, 1.0); }\r
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }\r
#endif

float ef_luminance(vec3 colour) {\r
  return dot(colour, vec3(0.2126, 0.7152, 0.0722));\r
}

float remap(float x, float lowIn, float highIn, float lowOut, float highOut) {\r
  float span = highIn - lowIn;\r
  float t = span == 0.0 ? step(lowIn, x) : (x - lowIn) / span;\r
  return lowOut + saturate(t) * (highOut - lowOut);\r
}

vec3 hdrClamp(vec3 colour) {\r
  vec3 safe;\r
  safe.x = colour.x == colour.x ? colour.x : 0.0;\r
  safe.y = colour.y == colour.y ? colour.y : 0.0;\r
  safe.z = colour.z == colour.z ? colour.z : 0.0;\r
  
  
  return clamp(safe, vec3(0.0), vec3(60000.0));\r
}

float hdrClampAlpha(float alpha) {\r
  return clamp(alpha == alpha ? alpha : 0.0, 0.0, 1.0);\r
}

#endif

attribute float aPhase;

attribute float aStiffness;

uniform vec2 uWind;
uniform float uTime;

uniform float uBendScale;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vHeightFraction;
varying float vViewDistance;

void main() {
  vec3 local = position;

  #ifdef USE_INSTANCING
    vec3 rootWorld = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  #else
    vec3 rootWorld = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  #endif

  float windSpeed = length(uWind);
  vec2 windDir = windSpeed > EPS ? uWind / windSpeed : vec2(0.0, 1.0);

  
  
  float gustPhase = dot(rootWorld.xz, windDir) * 0.055 - uTime * (0.6 + windSpeed * 0.09);
  float gust = 0.62 + 0.38 * sin(gustPhase);
  float flutter = sin(uTime * (2.4 + aPhase * 1.7) + aPhase * TWO_PI);

  
  float along = uv.y;
  float lean = along * along * aStiffness * uBendScale * windSpeed * (gust + 0.16 * flutter);

  local.xz += windDir * lean;
  
  local.y -= along * lean * lean * 0.35;

  #ifdef USE_INSTANCING
    vec4 world = modelMatrix * instanceMatrix * vec4(local, 1.0);
    vec3 worldNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  #else
    vec4 world = modelMatrix * vec4(local, 1.0);
    vec3 worldNormal = normalize(mat3(modelMatrix) * normal);
  #endif

  vWorldPosition = world.xyz;
  vNormal = worldNormal;
  vUv = uv;
  vHeightFraction = along;
  vViewDistance = distance(world.xyz, cameraPosition);

  gl_Position = projectionMatrix * viewMatrix * world;
}`,Jp=`precision highp float;

#ifndef ENDLESS_FISHING_WORLDLIGHT\r
#define ENDLESS_FISHING_WORLDLIGHT

#ifndef ENDLESS_FISHING_CONSTANTS\r
#define ENDLESS_FISHING_CONSTANTS

const float PI = 3.14159265358979323846;\r
const float TWO_PI = 6.28318530717958647692;\r
const float HALF_PI = 1.57079632679489661923;\r
const float INV_PI = 0.31830988618379067154;\r
const float INV_FOUR_PI = 0.07957747154594766788;\r
const float DEG_TO_RAD = 0.01745329251994329577;\r
const float RAD_TO_DEG = 57.2957795130823208768;

const float EPS = 1e-6;

#ifndef saturate\r
float saturate(float x) { return clamp(x, 0.0, 1.0); }\r
vec2 saturate(vec2 x) { return clamp(x, 0.0, 1.0); }\r
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }\r
#endif

float ef_luminance(vec3 colour) {\r
  return dot(colour, vec3(0.2126, 0.7152, 0.0722));\r
}

float remap(float x, float lowIn, float highIn, float lowOut, float highOut) {\r
  float span = highIn - lowIn;\r
  float t = span == 0.0 ? step(lowIn, x) : (x - lowIn) / span;\r
  return lowOut + saturate(t) * (highOut - lowOut);\r
}

vec3 hdrClamp(vec3 colour) {\r
  vec3 safe;\r
  safe.x = colour.x == colour.x ? colour.x : 0.0;\r
  safe.y = colour.y == colour.y ? colour.y : 0.0;\r
  safe.z = colour.z == colour.z ? colour.z : 0.0;\r
  
  
  return clamp(safe, vec3(0.0), vec3(60000.0));\r
}

float hdrClampAlpha(float alpha) {\r
  return clamp(alpha == alpha ? alpha : 0.0, 0.0, 1.0);\r
}

#endif\r
#ifndef ENDLESS_FISHING_AIRLIGHT\r
#define ENDLESS_FISHING_AIRLIGHT

vec3 ef_airLight(samplerCube environment, float intensity, vec3 V) {\r
  vec3 direction = normalize(vec3(-V.x, max(-V.y, 0.07), -V.z) + vec3(EPS, 0.0, 0.0));\r
  return textureCubeLodEXT(environment, direction, 1.0).rgb * intensity;\r
}

#endif

uniform vec3 uSunDirection;\r
uniform vec3 uSunColour;

uniform float uSunIlluminance;\r
uniform vec3 uMoonDirection;\r
uniform vec3 uMoonColour;\r
uniform float uMoonIlluminance;

uniform samplerCube uEnvironment;\r
uniform float uEnvironmentIntensity;

uniform float uVisibility;

float ef_ggx(float nDotH, float roughness) {\r
  float a = roughness * roughness;\r
  float a2 = a * a;\r
  float d = nDotH * nDotH * (a2 - 1.0) + 1.0;\r
  return a2 / max(EPS, PI * d * d);\r
}

float ef_smith(float nDotV, float nDotL, float roughness) {\r
  float k = roughness * roughness * 0.5;\r
  return (nDotV / (nDotV * (1.0 - k) + k)) * (nDotL / (nDotL * (1.0 - k) + k));\r
}

vec3 ef_fresnel(float cosTheta, vec3 f0) {\r
  float m = clamp(1.0 - cosTheta, 0.0, 1.0);\r
  float m2 = m * m;\r
  return f0 + (1.0 - f0) * m2 * m2 * m;\r
}

vec3 ef_directLight(\r
    vec3 L, vec3 colour, float illuminance,\r
    vec3 N, vec3 V, vec3 albedo, vec3 f0, float roughness) {\r
  if (illuminance <= 0.0) return vec3(0.0);

  float nDotL = dot(N, L);\r
  if (nDotL <= 0.0) return vec3(0.0);

  float horizon = smoothstep(-0.035, 0.02, L.y);\r
  if (horizon <= 0.0) return vec3(0.0);

  float nDotV = max(1e-3, dot(N, V));\r
  vec3 H = normalize(L + V);\r
  float nDotH = max(0.0, dot(N, H));

  float D = ef_ggx(nDotH, roughness);\r
  float G = ef_smith(nDotV, nDotL, roughness);\r
  vec3 F = ef_fresnel(max(0.0, dot(H, V)), f0);\r
  vec3 specular = (D * G / (4.0 * nDotV * nDotL + EPS)) * F;

  return colour * illuminance * nDotL * horizon * (albedo * INV_PI * (1.0 - F) + specular);\r
}

vec3 ef_shadeSurface(vec3 albedo, vec3 N, vec3 V, float roughness, float occlusion, vec3 f0) {\r
  vec3 colour = vec3(0.0);\r
  colour += ef_directLight(uSunDirection, uSunColour, uSunIlluminance, N, V, albedo, f0, roughness);\r
  colour += ef_directLight(uMoonDirection, uMoonColour, uMoonIlluminance, N, V, albedo, f0, roughness);

  
  
  
  vec3 irradiance = textureCubeLodEXT(uEnvironment, N, 6.0).rgb * uEnvironmentIntensity;\r
  vec3 R = reflect(-V, N);\r
  vec3 reflection = textureCubeLodEXT(uEnvironment, R, roughness * 7.0).rgb * uEnvironmentIntensity;

  float nDotV = max(1e-3, dot(N, V));\r
  vec3 F = ef_fresnel(nDotV, f0);\r
  colour += albedo * irradiance * occlusion;\r
  colour += reflection * F * occlusion;

  return colour;\r
}

vec3 ef_aerialPerspective(vec3 colour, float distanceToCamera, vec3 V) {\r
  float extinction = 3.912 / max(200.0, uVisibility);\r
  float t = 1.0 - exp(-extinction * distanceToCamera);\r
  return mix(colour, ef_airLight(uEnvironment, uEnvironmentIntensity, V), t);\r
}

#endif

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vHeightFraction;
varying float vViewDistance;

uniform float uLeafMask;
uniform vec3 uBaseColour;
uniform vec3 uTipColour;

uniform float uFadeStart;
uniform float uFadeEnd;

float clusterMask(vec2 uv) {
  vec2 p = uv * 2.0 - 1.0;
  float a = length(p * vec2(1.0, 1.25) - vec2(0.0, -0.15)) - 0.78;
  float b = length((p - vec2(0.42, 0.34)) * 1.7) - 0.62;
  float c = length((p + vec2(0.45, 0.22)) * 1.75) - 0.6;
  float d = min(a, min(b, c));
  
  d += 0.13 * sin(atan(p.y, p.x) * 9.0) * length(p);
  return 1.0 - smoothstep(-0.03, 0.05, d);
}

void main() {
  float mask = mix(1.0, clusterMask(vUv), uLeafMask);
  
  
  float fade = 1.0 - smoothstep(uFadeStart, uFadeEnd, vViewDistance);
  if (mask * fade < 0.5) discard;

  vec3 viewVector = cameraPosition - vWorldPosition;
  vec3 V = viewVector / max(EPS, vViewDistance);

  vec3 geometric = normalize(vNormal);
  
  
  if (dot(geometric, V) < 0.0) geometric = -geometric;
  vec3 N = normalize(mix(geometric, vec3(0.0, 1.0, 0.0), 0.55));

  vec3 albedo = mix(uBaseColour, uTipColour, vHeightFraction);
  
  float occlusion = mix(0.35, 1.0, vHeightFraction);

  vec3 colour = ef_shadeSurface(albedo, N, V, 0.72, occlusion, vec3(0.028));

  
  
  float sunThrough = pow(max(0.0, dot(V, -uSunDirection)), 2.2);
  float moonThrough = pow(max(0.0, dot(V, -uMoonDirection)), 2.2);
  colour += albedo * 1.7 * (uSunColour * uSunIlluminance * sunThrough +
                            uMoonColour * uMoonIlluminance * moonThrough);

  colour = ef_aerialPerspective(colour, vViewDistance, V);

  gl_FragColor = vec4(hdrClamp(colour), 1.0);
}`,Yp=`precision highp float;

attribute vec3 aTint;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vTint;
varying float vViewDistance;

void main() {
  #ifdef USE_INSTANCING
    vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vec3 worldNormal = mat3(modelMatrix) * mat3(instanceMatrix) * normal;
  #else
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec3 worldNormal = mat3(modelMatrix) * normal;
  #endif

  vWorldPosition = world.xyz;
  vNormal = normalize(worldNormal);
  vUv = uv;
  vTint = aTint;
  vViewDistance = distance(world.xyz, cameraPosition);

  gl_Position = projectionMatrix * viewMatrix * world;
}`,Xp=`precision highp float;

#ifndef ENDLESS_FISHING_WORLDLIGHT\r
#define ENDLESS_FISHING_WORLDLIGHT

#ifndef ENDLESS_FISHING_CONSTANTS\r
#define ENDLESS_FISHING_CONSTANTS

const float PI = 3.14159265358979323846;\r
const float TWO_PI = 6.28318530717958647692;\r
const float HALF_PI = 1.57079632679489661923;\r
const float INV_PI = 0.31830988618379067154;\r
const float INV_FOUR_PI = 0.07957747154594766788;\r
const float DEG_TO_RAD = 0.01745329251994329577;\r
const float RAD_TO_DEG = 57.2957795130823208768;

const float EPS = 1e-6;

#ifndef saturate\r
float saturate(float x) { return clamp(x, 0.0, 1.0); }\r
vec2 saturate(vec2 x) { return clamp(x, 0.0, 1.0); }\r
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }\r
#endif

float ef_luminance(vec3 colour) {\r
  return dot(colour, vec3(0.2126, 0.7152, 0.0722));\r
}

float remap(float x, float lowIn, float highIn, float lowOut, float highOut) {\r
  float span = highIn - lowIn;\r
  float t = span == 0.0 ? step(lowIn, x) : (x - lowIn) / span;\r
  return lowOut + saturate(t) * (highOut - lowOut);\r
}

vec3 hdrClamp(vec3 colour) {\r
  vec3 safe;\r
  safe.x = colour.x == colour.x ? colour.x : 0.0;\r
  safe.y = colour.y == colour.y ? colour.y : 0.0;\r
  safe.z = colour.z == colour.z ? colour.z : 0.0;\r
  
  
  return clamp(safe, vec3(0.0), vec3(60000.0));\r
}

float hdrClampAlpha(float alpha) {\r
  return clamp(alpha == alpha ? alpha : 0.0, 0.0, 1.0);\r
}

#endif\r
#ifndef ENDLESS_FISHING_AIRLIGHT\r
#define ENDLESS_FISHING_AIRLIGHT

vec3 ef_airLight(samplerCube environment, float intensity, vec3 V) {\r
  vec3 direction = normalize(vec3(-V.x, max(-V.y, 0.07), -V.z) + vec3(EPS, 0.0, 0.0));\r
  return textureCubeLodEXT(environment, direction, 1.0).rgb * intensity;\r
}

#endif

uniform vec3 uSunDirection;\r
uniform vec3 uSunColour;

uniform float uSunIlluminance;\r
uniform vec3 uMoonDirection;\r
uniform vec3 uMoonColour;\r
uniform float uMoonIlluminance;

uniform samplerCube uEnvironment;\r
uniform float uEnvironmentIntensity;

uniform float uVisibility;

float ef_ggx(float nDotH, float roughness) {\r
  float a = roughness * roughness;\r
  float a2 = a * a;\r
  float d = nDotH * nDotH * (a2 - 1.0) + 1.0;\r
  return a2 / max(EPS, PI * d * d);\r
}

float ef_smith(float nDotV, float nDotL, float roughness) {\r
  float k = roughness * roughness * 0.5;\r
  return (nDotV / (nDotV * (1.0 - k) + k)) * (nDotL / (nDotL * (1.0 - k) + k));\r
}

vec3 ef_fresnel(float cosTheta, vec3 f0) {\r
  float m = clamp(1.0 - cosTheta, 0.0, 1.0);\r
  float m2 = m * m;\r
  return f0 + (1.0 - f0) * m2 * m2 * m;\r
}

vec3 ef_directLight(\r
    vec3 L, vec3 colour, float illuminance,\r
    vec3 N, vec3 V, vec3 albedo, vec3 f0, float roughness) {\r
  if (illuminance <= 0.0) return vec3(0.0);

  float nDotL = dot(N, L);\r
  if (nDotL <= 0.0) return vec3(0.0);

  float horizon = smoothstep(-0.035, 0.02, L.y);\r
  if (horizon <= 0.0) return vec3(0.0);

  float nDotV = max(1e-3, dot(N, V));\r
  vec3 H = normalize(L + V);\r
  float nDotH = max(0.0, dot(N, H));

  float D = ef_ggx(nDotH, roughness);\r
  float G = ef_smith(nDotV, nDotL, roughness);\r
  vec3 F = ef_fresnel(max(0.0, dot(H, V)), f0);\r
  vec3 specular = (D * G / (4.0 * nDotV * nDotL + EPS)) * F;

  return colour * illuminance * nDotL * horizon * (albedo * INV_PI * (1.0 - F) + specular);\r
}

vec3 ef_shadeSurface(vec3 albedo, vec3 N, vec3 V, float roughness, float occlusion, vec3 f0) {\r
  vec3 colour = vec3(0.0);\r
  colour += ef_directLight(uSunDirection, uSunColour, uSunIlluminance, N, V, albedo, f0, roughness);\r
  colour += ef_directLight(uMoonDirection, uMoonColour, uMoonIlluminance, N, V, albedo, f0, roughness);

  
  
  
  vec3 irradiance = textureCubeLodEXT(uEnvironment, N, 6.0).rgb * uEnvironmentIntensity;\r
  vec3 R = reflect(-V, N);\r
  vec3 reflection = textureCubeLodEXT(uEnvironment, R, roughness * 7.0).rgb * uEnvironmentIntensity;

  float nDotV = max(1e-3, dot(N, V));\r
  vec3 F = ef_fresnel(nDotV, f0);\r
  colour += albedo * irradiance * occlusion;\r
  colour += reflection * F * occlusion;

  return colour;\r
}

vec3 ef_aerialPerspective(vec3 colour, float distanceToCamera, vec3 V) {\r
  float extinction = 3.912 / max(200.0, uVisibility);\r
  float t = 1.0 - exp(-extinction * distanceToCamera);\r
  return mix(colour, ef_airLight(uEnvironment, uEnvironmentIntensity, V), t);\r
}

#endif

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vTint;
varying float vViewDistance;

uniform sampler2D uAlbedo;

uniform float uMapStrength;
uniform vec2 uMapScale;
uniform float uRoughness;
uniform float uMetalness;

uniform float uSplashLine;
uniform float uTideHeight;

void main() {
  vec3 viewVector = cameraPosition - vWorldPosition;
  vec3 V = viewVector / max(EPS, vViewDistance);
  vec3 N = normalize(vNormal);
  if (dot(N, V) < 0.0 && gl_FrontFacing == false) N = -N;

  vec3 mapped = texture2D(uAlbedo, vUv * uMapScale).rgb;
  vec3 albedo = vTint * mix(vec3(1.0), mapped, uMapStrength);

  float roughness = uRoughness;

  
  
  
  float wet = 1.0 - smoothstep(0.0, 0.55, vWorldPosition.y - (uTideHeight + uSplashLine));
  albedo *= mix(1.0, 0.34, wet);
  albedo = mix(albedo, albedo * vec3(0.82, 0.95, 0.86), wet);
  roughness = mix(roughness, 0.18, wet * 0.85);

  vec3 f0 = mix(vec3(0.04), albedo, uMetalness);
  vec3 diffuse = albedo * (1.0 - uMetalness);

  vec3 colour = ef_shadeSurface(diffuse, N, V, clamp(roughness, 0.05, 1.0), 1.0, f0);
  colour = ef_aerialPerspective(colour, vViewDistance, V);

  gl_FragColor = vec4(hdrClamp(colour), 1.0);
}`,Zp=[96,48,24],Qp=[0,380,900],$p=1200,em=2600,tm=40,nm=700,rm=170,im=-7,am=.055,om=.02,sm=new a(.045,.058,.032),cm=new a(.112,.124,.07),lm=new a(.028,.045,.03),um=new a(.055,.078,.042),dm=new b,fm=new t,pm=new P,mm=new t,hm=new t(0,1,0),gm=class e{name=`islands`;priority=15;field;engine;terrainMaterial;grassMaterial;leafMaterial;barkMaterial;trees;tuft;indices;grid;rigs=[];freeRigs=[];density=1;constructor(e,t,n,r){this.engine=e,this.field=new fp(e.settings.world.seed),this.terrainMaterial=new i({vertexShader:Gp,fragmentShader:Kp,uniforms:{...Oo(),uSandAlbedo:{value:t.albedo},uSandNormal:{value:t.normal},uSandOrm:{value:t.orm},uRockAlbedo:{value:n.albedo},uRockNormal:{value:n.normal},uRockOrm:{value:n.orm},uTideHeight:{value:0},uHighWaterMark:{value:.9},uLowWaterMark:{value:-.9},uTime:{value:0}}}),this.grassMaterial=bm(0,sm,cm,am,rm),this.leafMaterial=bm(1,lm,um,om,nm),this.barkMaterial=new i({vertexShader:Yp,fragmentShader:Xp,uniforms:{...Oo(),uAlbedo:{value:r},uMapStrength:{value:r===null?0:1},uMapScale:{value:new x(1,.55)},uRoughness:{value:.88},uMetalness:{value:0},uSplashLine:{value:-6},uTideHeight:{value:0}}});let a=e.settings.world.seed;this.trees=[Up(0,a^31745),Up(1,a^31746)],this.tuft=Wp(a^26533),this.indices=Zp.map(e=>Dp(e)),this.grid=new $d(this.factory,a^6749,{creationBudget:1,hysteresis:1,poolLimit:64}),this.applyQuality()}static async create(t,n){let[r,i,a]=await Promise.all([n.load(`Ground054`,{repeat:1}),n.load(`Rock064`,{repeat:1}),n.load(`Bark014`,{repeat:1})]);return new e(t,_m(r),_m(i),a.map)}seabedDepthAt(e,t){return this.field.depthAt(e,t)}heightAt(e,t){return this.field.heightAt(e,t)}update(e,t){let n=t.world,r=t.camera.position;this.grid.update(r.x,r.z);let i=t.get(`tides`),a=this.terrainMaterial.uniforms;vm(a,`uTideHeight`,n.tideHeight),vm(a,`uTime`,t.loop.elapsed),i!==void 0&&(vm(a,`uHighWaterMark`,i.highWaterMarkM),vm(a,`uLowWaterMark`,i.lowWaterMarkM)),vm(this.barkMaterial.uniforms,`uTideHeight`,n.tideHeight);for(let e of[this.grassMaterial,this.leafMaterial]){let r=e.uniforms.uWind;r!==void 0&&r.value.set(n.windX,n.windZ),vm(e.uniforms,`uTime`,t.loop.elapsed)}let o=ko(t);Ao(a,t,o),Ao(this.grassMaterial.uniforms,t,o),Ao(this.leafMaterial.uniforms,t,o),Ao(this.barkMaterial.uniforms,t,o);let s=nm*nm;for(let e of this.grid.active){let n=e.rig;if(!e.land||n===null)continue;n.lod.update(t.camera);let i=e.centreX-r.x,a=e.centreZ-r.z,o=i*i+a*a,c=o<s;for(let e=0;e<n.trunks.length;e+=1){let t=n.trunks[e],r=n.canopies[e];t!==void 0&&(t.visible=c&&t.count>0),r!==void 0&&(r.visible=c&&r.count>0)}n.grass.visible=o<28900&&n.grass.count>0}}onSettingsChanged(){this.applyQuality()}dispose(){this.grid.dispose();for(let e of this.rigs)this.destroyRig(e);this.rigs.length=0,this.freeRigs.length=0,this.terrainMaterial.dispose(),this.grassMaterial.dispose(),this.leafMaterial.dispose(),this.barkMaterial.dispose(),this.tuft.dispose();for(let e of this.trees)e.trunk.dispose(),e.canopy.dispose()}applyQuality(){let e=this.engine.settings.graphics;this.density=G(e.instanceDensity,.1,1),this.grid.setDrawDistance(G(e.drawDistance,$p,em))}factory={chunkSize:256,create:(e,t)=>{let n={land:!1,centreX:0,centreZ:0,rig:null};return this.seed(n,e,t),n},reset:(e,t,n)=>{this.seed(e,t,n)},retire:e=>{this.release(e)},destroy:e=>{this.release(e)}};seed(e,t,n){if(e.centreX=(t+.5)*256,e.centreZ=(n+.5)*256,this.field.chunkPeak(t,n)<im){e.land=!1,this.release(e);return}let r=e.rig??this.borrowRig();if(r===null){e.land=!1;return}e.rig=r,e.land=!0;let i=Zp[0]??96;this.field.sampleChunkGrid(t,n,i,r.heights,r.stats),r.lod.visible=!0,r.lod.position.set(e.centreX,0,e.centreZ),r.lod.updateMatrix(),r.lod.updateMatrixWorld(!0);for(let e of r.levels)Ap(e,r.heights,i,r.stats);Cp(this.field,t,n,r.heights,i,r.content),this.plant(r)}plant(e){let t=e.content;for(let t of e.trunks)t.count=0;for(let t of e.canopies)t.count=0;let n=Math.round(t.treeCount*this.density);for(let r=0;r<n;r+=1){let n=r*6,i=t.trees[n+5]??0,a=e.trunks[i],o=e.canopies[i];if(a===void 0||o===void 0)continue;fm.set(t.trees[n]??0,t.trees[n+1]??0,t.trees[n+2]??0),pm.setFromAxisAngle(hm,t.trees[n+3]??0);let s=t.trees[n+4]??1;mm.set(s,s,s),dm.compose(fm,pm,mm),a.setMatrixAt(a.count,dm),o.setMatrixAt(o.count,dm),a.count+=1,o.count+=1}let r=Math.round(t.grassCount*this.density);for(let n=0;n<r;n+=1){let r=n*5;fm.set(t.grass[r]??0,t.grass[r+1]??0,t.grass[r+2]??0),pm.setFromAxisAngle(hm,t.grass[r+3]??0);let i=t.grass[r+4]??1;mm.set(i,i,i),dm.compose(fm,pm,mm),e.grass.setMatrixAt(n,dm)}e.grass.count=r;for(let t=0;t<e.trunks.length;t+=1)ym(e.trunks[t]),ym(e.canopies[t]);ym(e.grass)}borrowRig(){let e=this.freeRigs.pop();if(e!==void 0)return e;if(this.rigs.length>=tm)return null;let t=this.buildRig();return this.rigs.push(t),t}release(e){let t=e.rig;if(e.rig=null,e.land=!1,t!==null){t.lod.visible=!1,t.grass.visible=!1;for(let e of t.trunks)e.visible=!1;for(let e of t.canopies)e.visible=!1;this.freeRigs.push(t)}}buildRig(){let e=Zp[0]??96,t=new p;t.autoUpdate=!1;let n=Zp.map((e,n)=>{let r=kp(e,this.indices[n],this.terrainMaterial);return t.addLevel(r.mesh,Qp[n]??0),r}),r=[],i=[];for(let e=0;e<2;e+=1){let t=this.trees[e];t!==void 0&&(r.push(new s(t.trunk,this.barkMaterial,100)),i.push(new s(t.canopy,this.leafMaterial,100)))}let a=new s(this.tuft,this.grassMaterial,_p);t.visible=!1,a.visible=!1;for(let e of r)e.visible=!1;for(let e of i)e.visible=!1;return this.engine.scene.add(t,a,...r,...i),{lod:t,levels:n,heights:new Float32Array((e+3)*(e+3)),stats:up(),content:Sp(),trunks:r,canopies:i,grass:a}}destroyRig(e){this.engine.scene.remove(e.lod,e.grass,...e.trunks,...e.canopies);for(let t of e.levels)t.geometry.dispose();e.grass.dispose();for(let t of e.trunks)t.dispose();for(let t of e.canopies)t.dispose()}};function _m(e){return{albedo:e.map,normal:e.normalMap,orm:e.roughnessMap}}function vm(e,t,n){let r=e[t];r!==void 0&&(r.value=n)}function ym(e){e!==void 0&&(e.instanceMatrix.needsUpdate=!0,e.visible=e.count>0,e.count>0&&e.computeBoundingSphere())}function bm(e,t,n,r,a){return new i({vertexShader:qp,fragmentShader:Jp,uniforms:{...Oo(),uWind:{value:new x},uTime:{value:0},uBendScale:{value:r},uLeafMask:{value:e},uBaseColour:{value:t.clone()},uTipColour:{value:n.clone()},uFadeStart:{value:a*.75},uFadeEnd:{value:a}},side:2})}var xm=21.2,Sm=.055;function X(e,t){return t.rx!==void 0&&e.rotateX(t.rx),t.ry!==void 0&&e.rotateY(t.ry),t.rz!==void 0&&e.rotateZ(t.rz),e.translate(t.x??0,t.y??0,t.z??0),e}function Cm(e){let t=Me(e,!1);for(let t of e)t.dispose();if(t===null)throw Error(`PropGeometry: parts could not be merged`);return t.computeBoundingSphere(),t}function wm(){return Cm([X(new F(4.3,5.2,3.2,20),{y:1.6}),X(new F(2.15,3.7,16.6,20),{y:11.5}),X(new F(3.2,3.2,.55,20),{y:20.05}),X(new R(1.5,2.4,.5),{y:4.4,z:3.35})])}function Tm(){let e=[X(new c(3.1,.07,6,24),{rx:Math.PI/2,y:21.4}),X(new F(1.95,1.95,.18,16),{y:20.4}),X(new y(2.3,1.9,16),{y:23.6}),X(new u(.34,10,8),{y:24.8})];for(let t=0;t<8;t+=1){let n=t/8*Math.PI*2;e.push(X(new R(.11,3,.11),{x:Math.cos(n)*1.9,y:22.099999999999998,z:Math.sin(n)*1.9,ry:-n}))}return Cm(e)}function Em(){let e=[X(new F(1.05,1.15,1.8,14),{y:.25}),X(new y(1.15,2.2,14),{rz:Math.PI,y:-1.75}),X(new c(.78,.06,5,14),{rx:Math.PI/2,y:3.15}),X(new y(.44,.66,12,1,!0),{y:2.05}),X(new u(.11,8,6),{y:1.66})];for(let t=0;t<4;t+=1){let n=t/4*Math.PI*2+Math.PI/4;e.push(X(new R(.1,2.4,.1),{x:Math.cos(n)*.78,y:2,z:Math.sin(n)*.78}))}return Cm(e)}function Dm(){let e=[X(new R(2.8,.28,23),{y:1.55,z:11})];for(let t=0;t<5;t+=1){let n=1.6+t*5;for(let t of[-1,1])e.push(X(new F(.17,.2,7.4,8),{x:t*1.2,y:-2.3,z:n})),e.push(X(new R(.12,1,.12),{x:t*1.28,y:2.2,z:n}));e.push(X(new R(2.9,.22,.22),{y:2.62,z:n}))}return Cm(e)}function Om(){let e=[X(new F(2.4,1.5,13,10,1,!0,0,Math.PI),{rx:Math.PI/2,y:.4}),X(new R(3.6,2.4,.3),{y:.5,z:-6.4,rx:.2}),X(new F(.13,.19,6.5,6),{rx:.35,y:2.6,z:1.2})];for(let t=0;t<6;t+=1){let n=-4.4+t*1.9,r=2.3-Math.abs(n)*.09;e.push(X(new c(r,.09,5,10,Math.PI),{z:n,y:.3}))}let t=Cm(e);return t.rotateZ(.42),t.rotateX(-.12),t.computeBoundingSphere(),t}function km(){return Cm([X(new c(9,2.7,7,16,Math.PI),{y:.5}),X(new F(3.3,4.4,6,9),{x:-9,y:-2.4}),X(new F(3.3,4.4,6,9),{x:9,y:-2.4}),X(new u(2.2,8,6),{x:-2.4,y:10.6,z:.6})])}function Am(){let e=[X(new R(.92,.72,.92),{y:.12})];for(let t of[-.14,.38])e.push(X(new R(.98,.08,.98),{y:t}));return Cm(e)}function jm(){return Cm([X(new F(.055,.062,.24,10),{rx:Math.PI/2,y:.02}),X(new F(.022,.038,.11,8),{rx:Math.PI/2,y:.02,z:.17}),X(new u(.024,6,5),{y:.02,z:.225})])}function Mm(){let e=Math.tan(Sm)*420,t=new y(e,420,18,6,!0);t.translate(0,-420/2,0),t.rotateX(-Math.PI/2);let n=t.getAttribute(`position`),r=new Float32Array(n.count*4);for(let e=0;e<n.count;e+=1){let t=Math.min(1,Math.max(0,n.getZ(e)/420)),i=(1-t)**2*(1-t*t*t);r[e*4]=1,r[e*4+1]=.94,r[e*4+2]=.82,r[e*4+3]=i}return t.setAttribute(`color`,new j(r,4)),t.computeBoundingSphere(),t}var Nm={lighthouse:4,buoy:12,jetty:8,wreck:8,arch:6,crate:24,bottle:24},Pm={lighthouse:3e3,arch:2600,jetty:1400,wreck:1200,buoy:1200,crate:600,bottle:400},Fm=8,Im=26e4,Lm=.55,Rm=.24,zm=.14,Bm=4,Vm=5,Hm=.18,Um=new b,Wm=new t,Gm=new P,Km=new t(1,1,1),qm=new t,Jm=new a,Ym=new P,Xm=new t(0,1,0),Zm=new t,Qm=class t{name=`props`;priority=16;engine;field;grid;materials=[];parts=[];beam;beamMaterial;light;lightTarget=new le;taken=new Set;panners=[];swell=null;audio=null;bearing=0;beamStrength=0;lighthouseFound=!1;lighthouseX=0;lighthouseY=0;lighthouseZ=0;nextVoice=0;constructor(t,n,r){this.engine=t,this.field=n;let i=this.material(null,0,.62,0,-.2),o=this.material(r.metal,.85,.72,1,-.2),s=this.material(r.timber,1,.92,0,.45),c=this.material(r.rock,1,.88,0,.7),l=this.material(null,0,.09,0,.02);this.addPart(`lighthouse`,wm(),i,[new a(.79,.78,.75),new a(.74,.74,.72)]),this.addPart(`lighthouse`,Tm(),o,[new a(.1,.1,.11)]),this.addPart(`buoy`,Em(),i,[new a(.36,.05,.045),new a(.05,.26,.13)]),this.addPart(`jetty`,Dm(),s,[new a(.52,.49,.44)]),this.addPart(`wreck`,Om(),s,[new a(.21,.19,.17)]),this.addPart(`arch`,km(),c,[new a(.84,.85,.83)]),this.addPart(`crate`,Am(),s,[new a(.6,.54,.44),new a(.48,.42,.35)]),this.addPart(`bottle`,jm(),l,[new a(.24,.4,.29)]),this.beamMaterial=new ie({vertexColors:!0,transparent:!0,blending:2,depthWrite:!1,side:2,toneMapped:!1,opacity:0}),this.beam=new e(Mm(),this.beamMaterial),this.beam.frustumCulled=!1,this.beam.renderOrder=5,this.beam.visible=!1,this.light=new T(16773848,0,420,.075,.35,1.4),this.light.castShadow=!1,this.light.target=this.lightTarget,t.scene.add(this.beam,this.light,this.lightTarget),this.grid=new $d({chunkSize:512,create:(e,t)=>{let n={props:Tp(),bell:new Float32Array(12*Vm)};return Ep(this.field,e,t,n.props),n},reset:(e,t,n)=>{e.bell.fill(0),Ep(this.field,t,n,e.props)},retire:()=>{},destroy:()=>{}},t.settings.world.seed^40196,{creationBudget:2,hysteresis:1,poolLimit:24}),this.grid.setDrawDistance(G(t.settings.graphics.drawDistance,1200,3e3))}static async create(e,n,r){let[i,a,o]=await Promise.all([n.load(`Metal063`,{repeat:1}),n.load(`Planks023A`,{repeat:1}),n.load(`Rock064`,{repeat:1})]);return new t(e,r,{metal:i.map,timber:a.map,rock:o.map})}setSwell(e){this.swell=e}setBellAudio(e){this.audio=e;for(let e of this.panners)e.disconnect();if(this.panners.length=0,e!==null)for(let t=0;t<Bm;t+=1)this.panners.push(e.createPanner())}get beamLit(){return this.beamStrength}takeCollectable(e,t,n,r){let i=n*n,a=0,o=!1;for(let n of this.grid.active){let s=n.props;for(let n=0;n<s.count;n+=1){let c=n*8,l=wp[s.data[c]??0];if(l!==`crate`&&l!==`bottle`)continue;let u=$m(s.cx,s.cz,n);if(this.taken.has(u))continue;let d=s.data[c+1]??0,f=s.data[c+3]??0,p=(d-e)**2+(f-t)**2;p>=i||(i=p,a=u,o=!0,r.kind=l,r.x=d,r.z=f,r.y=this.waterAt(d,f))}}return o&&this.taken.add(a),o}fixedUpdate(e){for(let t of this.grid.active){let n=t.props;for(let r=0;r<n.count;r+=1)wp[n.data[r*8]??0]===`buoy`&&this.stepBell(t,r,e)}}update(e,t){let n=t.camera.position;this.grid.update(n.x,n.z);let r=ko(t);for(let e of this.materials){Ao(e.uniforms,t,r);let n=e.uniforms.uTideHeight;n!==void 0&&(n.value=t.world.tideHeight)}for(let e of this.parts)e.count=0;this.lighthouseFound=!1;let i=1/0;for(let e of this.grid.active){let t=e.props;for(let r=0;r<t.count;r+=1){let a=r*8,o=wp[t.data[a]??0];if(o===void 0||(o===`crate`||o===`bottle`)&&this.taken.has($m(t.cx,t.cz,r)))continue;let s=t.data[a+1]??0,c=t.data[a+3]??0,l=Pm[o];if((s-n.x)**2+(c-n.z)**2>l*l)continue;this.pose(o,e,r,s,t.data[a+2]??0,c);let u=t.data[a+5]??1;Km.set(u,u,u),Um.compose(Wm,Gm,Km);for(let e of this.parts){if(e.kind!==o||e.count>=e.mesh.instanceMatrix.count)continue;e.mesh.setMatrixAt(e.count,Um);let n=e.palette[Math.floor((t.data[a+6]??0)*e.palette.length)];Jm.copy(n??e.palette[0]??Jm),e.tint.setXYZ(e.count,Jm.r,Jm.g,Jm.b),e.count+=1}if(o===`lighthouse`){let e=(s-n.x)**2+(c-n.z)**2;e<i&&(i=e,this.lighthouseFound=!0,this.lighthouseX=s,this.lighthouseY=(t.data[a+2]??0)+xm*u,this.lighthouseZ=c)}}}for(let e of this.parts)e.mesh.count=e.count,e.mesh.visible=e.count>0,e.mesh.instanceMatrix.needsUpdate=!0,e.tint.needsUpdate=!0;this.updateBeam(e,t)}onSettingsChanged(e){this.grid.setDrawDistance(G(e.settings.graphics.drawDistance,1200,3e3))}dispose(){this.grid.dispose();for(let e of this.parts)e.mesh.dispose(),e.mesh.geometry.dispose();for(let e of this.materials)e.dispose();this.beam.geometry.dispose(),this.beamMaterial.dispose(),this.light.dispose();for(let e of this.panners)e.disconnect();this.panners.length=0,this.engine.scene.remove(this.beam,this.light,this.lightTarget)}material(e,t,n,r,a){let o=new i({vertexShader:Yp,fragmentShader:Xp,uniforms:{...Oo(),uAlbedo:{value:e},uMapStrength:{value:e===null?0:t},uMapScale:{value:new x(.45,.45)},uRoughness:{value:n},uMetalness:{value:r},uSplashLine:{value:a},uTideHeight:{value:0}}});return this.materials.push(o),o}addPart(e,t,n,r){let i=Nm[e],a=new w(new Float32Array(i*3),3);t.setAttribute(`aTint`,a);let o=new s(t,n,i);o.frustumCulled=!1,o.count=0,o.visible=!1,this.engine.scene.add(o),this.parts.push({kind:e,mesh:o,tint:a,palette:r,count:0})}pose(e,t,n,r,i,a){let o=n*8,s=t.props.data[o+4]??0;if(e!==`buoy`&&e!==`crate`&&e!==`bottle`){Wm.set(r,i,a),Gm.setFromAxisAngle(Xm,s);return}let c=this.waterAt(r,a);Wm.set(r,c+(e===`buoy`?0:Hm),a),this.swell===null?qm.set(0,1,0):this.swell.normalAt(r,a,qm),Zm.copy(Xm).cross(qm);let l=Zm.length();l<1e-5?Gm.setFromAxisAngle(Xm,s):(Zm.multiplyScalar(1/l),Gm.setFromAxisAngle(Zm,Math.asin(Math.min(1,l))),Gm.multiply(Ym.setFromAxisAngle(Xm,s))),e===`buoy`&&(t.bell[n*Vm+2]=Math.atan2(qm.x,Math.max(.05,qm.y)))}waterAt(e,t){return this.swell===null?this.engine.world.tideHeight:this.swell.heightAt(e,t)}stepBell(e,t,n){let r=t*Vm,i=e.bell[r]??0,a=e.bell[r+1]??0,o=e.bell[r+2]??0,s=e.bell[r+3]??0,c=e.bell[r+4]??0,l=a+(-23.349166666666665*Math.sin(i-o)-Lm*a)*n,u=i+l*n,d=u-o,f=Math.sign(d);if(Math.abs(d)>Rm&&f!==c&&s<=0){let n=G(Math.abs(l)/2.6,.08,1);this.ring(e,t,n),e.bell[r+3]=zm,e.bell[r+4]=f,e.bell[r]=o+Rm*f,e.bell[r+1]=-l*.35;return}e.bell[r]=u,e.bell[r+1]=l,e.bell[r+3]=Math.max(0,s-n)}ring(e,t,n){let r=this.audio;if(r===null||this.panners.length===0)return;let i=t*8,a=e.props.data[i+1]??0,o=e.props.data[i+3]??0,s=this.panners[this.nextVoice%this.panners.length];if(this.nextVoice+=1,s===void 0)return;r.setPosition(s,a,this.engine.world.tideHeight+2,o);let c=r.now();r.playTone({frequency:618,type:`triangle`,gain:.2*n,attack:.002,decay:1.7,destination:s,when:c}),r.playTone({frequency:309,type:`sine`,gain:.11*n,attack:.005,decay:3.4,destination:s,when:c})}updateBeam(e,t){this.bearing=(this.bearing+Math.PI*2*e/Fm)%(Math.PI*2);let n=1-W(-3.5,-.833,t.world.ephemeris?.sunAltitudeDeg??90);if(this.beamStrength=this.lighthouseFound?n:0,this.beamStrength<=.001){this.beam.visible=!1,this.light.intensity=0;return}this.beam.visible=!0,this.beam.position.set(this.lighthouseX,this.lighthouseY,this.lighthouseZ),this.beam.rotation.set(0,this.bearing,0),this.light.position.copy(this.beam.position),this.lightTarget.position.set(this.lighthouseX+Math.sin(this.bearing)*420,this.lighthouseY-6,this.lighthouseZ+Math.cos(this.bearing)*420),this.lightTarget.updateMatrixWorld(),this.light.intensity=Im*this.beamStrength;let r=G(1-t.world.visibility/2e4,.06,1);this.beamMaterial.opacity=this.beamStrength*(.1+r*.55)}};function $m(e,t,n){return lr(e,t,n)}var eh=.004,th=[{id:`mackerel`,name:`Atlantic mackerel`,latin:`Scomber scombrus`,rarity:`common`,weight:.3,minMassKg:.2,maxMassKg:1.6,minLengthM:.25,maxLengthM:.5,minDepthM:0,maxDepthM:40,minSunAltitudeDeg:-6,maxSunAltitudeDeg:90,minBeaufort:0,maxBeaufort:6,minTemperatureC:8,maxTemperatureC:20,baits:[`lure`,`shrimp`,`worm`,`sandeel`],bodyDepth:.17,bodyWidth:.11,forkedTail:!0,backColour:[.06,.14,.13],bellyColour:[.72,.74,.7],scaleDensity:34,iridescence:.85,pull:.35,runRate:1.6,stamina:9,valuePerKg:4},{id:`herring`,name:`Atlantic herring`,latin:`Clupea harengus`,rarity:`common`,weight:.24,minMassKg:.1,maxMassKg:.7,minLengthM:.2,maxLengthM:.38,minDepthM:5,maxDepthM:60,minSunAltitudeDeg:-14,maxSunAltitudeDeg:10,minBeaufort:0,maxBeaufort:5,minTemperatureC:4,maxTemperatureC:16,baits:[`lure`,`shrimp`,`bare`],bodyDepth:.19,bodyWidth:.09,forkedTail:!0,backColour:[.09,.16,.19],bellyColour:[.8,.81,.79],scaleDensity:40,iridescence:.95,pull:.22,runRate:1.2,stamina:6,valuePerKg:3},{id:`pollock`,name:`Pollock`,latin:`Pollachius pollachius`,rarity:`common`,weight:.26,minMassKg:.8,maxMassKg:9,minLengthM:.35,maxLengthM:1,minDepthM:10,maxDepthM:90,minSunAltitudeDeg:-10,maxSunAltitudeDeg:40,minBeaufort:0,maxBeaufort:7,minTemperatureC:4,maxTemperatureC:15,baits:[`lure`,`squid`,`sandeel`,`worm`],bodyDepth:.22,bodyWidth:.13,forkedTail:!1,backColour:[.1,.11,.08],bellyColour:[.62,.6,.54],scaleDensity:26,iridescence:.35,pull:.55,runRate:.9,stamina:14,valuePerKg:5},{id:`whiting`,name:`Whiting`,latin:`Merlangius merlangus`,rarity:`common`,weight:.2,minMassKg:.2,maxMassKg:1.8,minLengthM:.22,maxLengthM:.48,minDepthM:15,maxDepthM:110,minSunAltitudeDeg:-18,maxSunAltitudeDeg:30,minBeaufort:0,maxBeaufort:6,minTemperatureC:3,maxTemperatureC:14,baits:[`worm`,`squid`,`shrimp`],bodyDepth:.18,bodyWidth:.1,forkedTail:!1,backColour:[.16,.15,.12],bellyColour:[.76,.75,.72],scaleDensity:30,iridescence:.4,pull:.24,runRate:.8,stamina:7,valuePerKg:3.5},{id:`cod`,name:`Atlantic cod`,latin:`Gadus morhua`,rarity:`rare`,weight:.3,minMassKg:1.5,maxMassKg:28,minLengthM:.45,maxLengthM:1.4,minDepthM:20,maxDepthM:200,minSunAltitudeDeg:-18,maxSunAltitudeDeg:25,minBeaufort:1,maxBeaufort:8,minTemperatureC:1,maxTemperatureC:12,baits:[`squid`,`worm`,`sandeel`,`lure`],bodyDepth:.24,bodyWidth:.15,forkedTail:!1,backColour:[.2,.17,.09],bellyColour:[.72,.7,.62],scaleDensity:24,iridescence:.25,pull:.72,runRate:.7,stamina:22,valuePerKg:9},{id:`haddock`,name:`Haddock`,latin:`Melanogrammus aeglefinus`,rarity:`rare`,weight:.24,minMassKg:.7,maxMassKg:7,minLengthM:.35,maxLengthM:.9,minDepthM:40,maxDepthM:180,minSunAltitudeDeg:-18,maxSunAltitudeDeg:30,minBeaufort:0,maxBeaufort:7,minTemperatureC:2,maxTemperatureC:11,baits:[`worm`,`squid`,`shrimp`],bodyDepth:.23,bodyWidth:.13,forkedTail:!1,backColour:[.13,.13,.14],bellyColour:[.74,.73,.71],scaleDensity:27,iridescence:.3,pull:.5,runRate:.8,stamina:15,valuePerKg:8},{id:`sea-bass`,name:`European sea bass`,latin:`Dicentrarchus labrax`,rarity:`rare`,weight:.26,minMassKg:.8,maxMassKg:8,minLengthM:.35,maxLengthM:.9,minDepthM:0,maxDepthM:35,minSunAltitudeDeg:-8,maxSunAltitudeDeg:12,minBeaufort:2,maxBeaufort:7,minTemperatureC:8,maxTemperatureC:20,baits:[`lure`,`sandeel`,`squid`],bodyDepth:.21,bodyWidth:.12,forkedTail:!0,backColour:[.14,.16,.18],bellyColour:[.78,.78,.76],scaleDensity:30,iridescence:.6,pull:.78,runRate:1.5,stamina:18,valuePerKg:14},{id:`plaice`,name:`European plaice`,latin:`Pleuronectes platessa`,rarity:`rare`,weight:.2,minMassKg:.3,maxMassKg:4,minLengthM:.25,maxLengthM:.7,minDepthM:10,maxDepthM:80,minSunAltitudeDeg:-6,maxSunAltitudeDeg:50,minBeaufort:0,maxBeaufort:5,minTemperatureC:4,maxTemperatureC:15,baits:[`worm`,`shrimp`],bodyDepth:.55,bodyWidth:.06,forkedTail:!1,backColour:[.18,.14,.07],bellyColour:[.82,.8,.74],scaleDensity:22,iridescence:.15,pull:.42,runRate:.4,stamina:11,valuePerKg:11},{id:`ling`,name:`Common ling`,latin:`Molva molva`,rarity:`epic`,weight:.34,minMassKg:4,maxMassKg:32,minLengthM:.8,maxLengthM:1.8,minDepthM:80,maxDepthM:400,minSunAltitudeDeg:-18,maxSunAltitudeDeg:8,minBeaufort:2,maxBeaufort:9,minTemperatureC:2,maxTemperatureC:10,baits:[`squid`,`sandeel`],bodyDepth:.14,bodyWidth:.11,forkedTail:!1,backColour:[.16,.14,.1],bellyColour:[.66,.64,.58],scaleDensity:20,iridescence:.2,pull:.85,runRate:.6,stamina:28,valuePerKg:13},{id:`wolffish`,name:`Atlantic wolffish`,latin:`Anarhichas lupus`,rarity:`epic`,weight:.33,minMassKg:3,maxMassKg:20,minLengthM:.6,maxLengthM:1.4,minDepthM:60,maxDepthM:300,minSunAltitudeDeg:-18,maxSunAltitudeDeg:5,minBeaufort:6,maxBeaufort:12,minTemperatureC:-1,maxTemperatureC:8,baits:[`squid`,`shrimp`,`sandeel`],bodyDepth:.16,bodyWidth:.13,forkedTail:!1,backColour:[.11,.12,.15],bellyColour:[.44,.45,.47],scaleDensity:16,iridescence:.1,pull:.92,runRate:.5,stamina:26,valuePerKg:17},{id:`conger`,name:`European conger`,latin:`Conger conger`,rarity:`epic`,weight:.33,minMassKg:5,maxMassKg:60,minLengthM:1,maxLengthM:2.6,minDepthM:20,maxDepthM:250,minSunAltitudeDeg:-18,maxSunAltitudeDeg:-2,minBeaufort:0,maxBeaufort:8,minTemperatureC:6,maxTemperatureC:16,baits:[`squid`,`sandeel`],bodyDepth:.1,bodyWidth:.09,forkedTail:!1,backColour:[.09,.1,.09],bellyColour:[.5,.49,.45],scaleDensity:14,iridescence:.12,pull:.95,runRate:.45,stamina:34,valuePerKg:15},{id:`halibut`,name:`Atlantic halibut`,latin:`Hippoglossus hippoglossus`,rarity:`legendary`,weight:1,minMassKg:25,maxMassKg:220,minLengthM:1.2,maxLengthM:2.5,minDepthM:100,maxDepthM:700,minSunAltitudeDeg:-18,maxSunAltitudeDeg:6,minBeaufort:5,maxBeaufort:12,minTemperatureC:1,maxTemperatureC:9,baits:[`sandeel`,`squid`],bodyDepth:.48,bodyWidth:.09,forkedTail:!1,backColour:[.13,.12,.1],bellyColour:[.86,.85,.81],scaleDensity:18,iridescence:.18,pull:1,runRate:.35,stamina:55,valuePerKg:26}],nh={common:.68,rare:.25,epic:.062,legendary:.008};function rh(e,t){let n=ih(t.depthM,e.minDepthM,e.maxDepthM,12),r=ih(t.sunAltitudeDeg,e.minSunAltitudeDeg,e.maxSunAltitudeDeg,3),i=ih(t.beaufort,e.minBeaufort,e.maxBeaufort,1),a=ih(t.waterTemperatureC,e.minTemperatureC,e.maxTemperatureC,2.5),o=e.baits.includes(t.bait)?1:.12;return n*r*i*a*o}function ih(e,t,n,r){if(r<=0)return+(e>=t&&e<=n);let i=ah(t-r,t+r*.35,e),a=1-ah(n-r*.35,n+r,e);return Math.max(0,Math.min(i,a))}function ah(e,t,n){if(e===t)return n<e?0:1;let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)}function oh(e,t){let n=Math.min(1,Math.max(0,e.rarity)),r=[[`common`,nh.common*(1-.45*n)],[`rare`,nh.rare*(1+.35*n)],[`epic`,nh.epic*(1+2.2*n)],[`legendary`,nh.legendary*(1+5*n)]],i=0;for(let[,e]of r)i+=e;let a=t.next()*i,o=`common`;for(let[e,t]of r)if(a-=t,a<=0){o=e;break}let s=0,c=[];for(let t of th){if(t.rarity!==o)continue;let n=t.weight*rh(t,e);n<=0||(c.push({species:t,weight:n}),s+=n)}if(s<=0)return;let l=t.next()*s;for(let e of c)if(l-=e.weight,l<=0)return e.species;return c[c.length-1]?.species}function sh(e,t){let n=Math.min(1,Math.max(0,t.gaussian(.28,.22))),r=Math.log(e.minMassKg),i=Math.log(e.maxMassKg),a=Math.exp(r+(i-r)*n),o=(a-e.minMassKg)/Math.max(1e-6,e.maxMassKg-e.minMassKg),s=e.minLengthM+(e.maxLengthM-e.minLengthM)*Math.cbrt(Math.max(0,o)),c=t.next()<eh;return{species:e,massKg:a,lengthM:s,albino:c,value:a*e.valuePerKg*(c?6:1)}}var ch=16,lh=12,uh=.86,dh=.3,fh=.14,ph=.14,mh=.004;function hh(e){return e<=0?0:e>=uh?ph:(e<dh?Math.sqrt(Math.max(0,1-(1-e/dh)**2)):1)*(1-.86*(e<dh?0:(e-dh)/.56)**1.45)}function gh(e){return .5-e}var _h=6;function vh(e){return e<=_h?e/_h*dh:dh+(e-_h)/10*.56}function yh(e,t){return t*((e>=0?e:e*1.1400000000000001)+fh*.5)*(2/2.14)}var bh=class{positions=[];uvs=[];spine=[];traits=[];indices=[];get count(){return this.positions.length/3}vertex(e,t,n,r,i,a,o,s){let c=this.count;return this.positions.push(e,t,n),this.uvs.push(r,i),this.spine.push(a),this.traits.push(o,s),c}triangle(e,t,n){this.indices.push(e,t,n)}quad(e,t,n,r,i=!1){i?this.indices.push(e,n,t,t,n,r):this.indices.push(e,t,n,t,r,n)}};function xh(e,t,n,r,i){let a=hh(e);i.x=.5*r*a*Math.sin(t),i.y=yh(Math.cos(t),.5*n*a),i.z=gh(e)}function Sh(e){return Math.sin(Math.PI*e**.72)}function Ch(e,t,n,r,i,a,o,s,c,l,u){let d={x:0,y:0,z:0},f={x:0,y:0,z:0};xh(r,a,t,n,d),xh(i,a,t,n,f),f.x-=d.x,f.y-=d.y,f.z-=d.z;let p=f.y*c-f.z*s,m=f.z*o-f.x*c,h=f.x*s-f.y*o,g=Math.hypot(p,m,h);g<1e-9?(p=1,m=0,h=0):(p/=g,m/=g,h/=g);let _={x:0,y:0,z:0};for(let d of[1,-1]){let f=e.count;for(let f=0;f<=u;f+=1){let g=f/u,v=mh*(1-g)*d;for(let u=0;u<=l;u+=1){let d=u/l,f=r+(i-r)*d;xh(f,a,t,n,_);let y=Sh(d)*g;e.vertex(_.x*.86+o*y+p*v,_.y*.86+s*y+m*v,_.z+c*y+h*v,d,g,f,g,0)}}let g=l+1;for(let t=0;t<u;t+=1)for(let n=0;n<l;n+=1){let r=f+t*g+n;e.quad(r,r+1,r+g,r+g+1,d<0)}}}function wh(e,t,n){let r=gh(uh),i=.5*t.bodyDepth*hh(uh),a=r-gh(1),o=t.forkedTail?a*.5:0,s=t.forkedTail?0:a*.25;for(let a of[1,-1]){let c=e.count;for(let c=0;c<=4;c+=1){let l=c/4,u=mh*(1-l)*a;for(let a=0;a<=12;a+=1){let c=a/12,d=c*2-1,f=i*d,p=n*(t.forkedTail?d:d*.8),m=t.forkedTail?gh(1)+o*(1-Math.abs(d)**1.5):gh(1)+s*d*d;e.vertex(u,f+(p-f)*l,r+(m-r)*l,c,l,uh+.14*l,l,0)}}for(let t=0;t<4;t+=1)for(let n=0;n<12;n+=1){let r=c+t*13+n;e.quad(r,r+1,r+13,r+13+1,a<0)}}}function Th(e,t,n){let r=.1,i=n*Math.PI*.42,a={x:0,y:0,z:0};xh(r,i,t.bodyDepth,t.bodyWidth,a);let o=.5*t.bodyWidth*hh(r)*.5,s=a.x*(1+o/Math.max(1e-4,Math.abs(a.x))*.33),c=e.count;for(let t=0;t<=5;t+=1){let i=t/5*Math.PI,c=Math.cos(i),l=Math.sin(i);for(let i=0;i<=8;i+=1){let u=i/8*Math.PI*2;e.vertex(s+n*o*c*.5,a.y+o*l*Math.cos(u),a.z+o*l*Math.sin(u),i/8,t/5,r,0,1)}}for(let t=0;t<5;t+=1)for(let r=0;r<8;r+=1){let i=c+t*9+r;e.quad(i,i+1,i+9,i+9+1,n<0)}}function Eh(e){return e.forkedTail?.09+.2*e.bodyDepth:.06+.3*e.bodyDepth}function Dh(e){let t=new bh,n={x:0,y:0,z:0},r=e.bodyDepth,i=e.bodyWidth,a=t.vertex(0,0,gh(0),.5,0,0,0,0),o=t.count;for(let e=1;e<=ch;e+=1){let a=vh(e);for(let e=0;e<=lh;e+=1)xh(a,e/lh*Math.PI*2,r,i,n),t.vertex(n.x,n.y,n.z,e/lh,a,a,0,0)}for(let e=0;e<lh;e+=1)t.triangle(a,o+e+1,o+e);for(let e=0;e+1<ch;e+=1)for(let n=0;n<lh;n+=1){let r=o+e*13+n;t.quad(r,r+1,r+13,r+13+1)}let s=o+195,c=t.vertex(0,0,gh(uh)-.006,.5,uh,uh,0,0);for(let e=0;e<lh;e+=1)t.triangle(c,s+e,s+e+1);let l=r*.52;Ch(t,r,i,.32,.62,0,0,l,-l*.3,7,3);let u=r*.34;Ch(t,r,i,.62,.79,Math.PI,0,-u,-u*.28,5,3);for(let e of[1,-1])Ch(t,r,i,.22,.3,e*Math.PI*.6,e*.085,-.04,-.115,5,3),Ch(t,r,i,.4,.47,e*Math.PI*.87,e*.03,-.05,-.055,4,2);wh(t,e,Eh(e)),Th(t,e,1),Th(t,e,-1);let d=new L;d.name=`fish:${e.id}`,d.setAttribute(`position`,new j(new Float32Array(t.positions),3)),d.setAttribute(`uv`,new j(new Float32Array(t.uvs),2)),d.setAttribute(`aSpine`,new j(new Float32Array(t.spine),1)),d.setAttribute(`aTrait`,new j(new Float32Array(t.traits),2)),d.setIndex(t.indices),d.computeVertexNormals();let f=d.getAttribute(`normal`);for(let e=0;e<ch;e+=1){let t=o+e*13,n=t+lh;f.setXYZ(n,f.getX(t),f.getY(t),f.getZ(t))}return f.needsUpdate=!0,d.computeBoundingSphere(),d}var Oh=`precision highp float;

#ifndef ENDLESS_FISHING_CONSTANTS\r
#define ENDLESS_FISHING_CONSTANTS

const float PI = 3.14159265358979323846;\r
const float TWO_PI = 6.28318530717958647692;\r
const float HALF_PI = 1.57079632679489661923;\r
const float INV_PI = 0.31830988618379067154;\r
const float INV_FOUR_PI = 0.07957747154594766788;\r
const float DEG_TO_RAD = 0.01745329251994329577;\r
const float RAD_TO_DEG = 57.2957795130823208768;

const float EPS = 1e-6;

#ifndef saturate\r
float saturate(float x) { return clamp(x, 0.0, 1.0); }\r
vec2 saturate(vec2 x) { return clamp(x, 0.0, 1.0); }\r
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }\r
#endif

float ef_luminance(vec3 colour) {\r
  return dot(colour, vec3(0.2126, 0.7152, 0.0722));\r
}

float remap(float x, float lowIn, float highIn, float lowOut, float highOut) {\r
  float span = highIn - lowIn;\r
  float t = span == 0.0 ? step(lowIn, x) : (x - lowIn) / span;\r
  return lowOut + saturate(t) * (highOut - lowOut);\r
}

vec3 hdrClamp(vec3 colour) {\r
  vec3 safe;\r
  safe.x = colour.x == colour.x ? colour.x : 0.0;\r
  safe.y = colour.y == colour.y ? colour.y : 0.0;\r
  safe.z = colour.z == colour.z ? colour.z : 0.0;\r
  
  
  return clamp(safe, vec3(0.0), vec3(60000.0));\r
}

float hdrClampAlpha(float alpha) {\r
  return clamp(alpha == alpha ? alpha : 0.0, 0.0, 1.0);\r
}

#endif

attribute float aSpine;

attribute vec2 aTrait;

attribute float aPhase;
attribute float aSwim;
attribute float aVariation;

uniform float uTime;

uniform float uBeatHz;

uniform float uAmplitude;

uniform float uWavelength;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec2 vTrait;
varying vec3 vLocal;
varying float vVariation;
varying float vViewDistance;

const float ENV_A0 = 0.04;
const float ENV_A1 = -0.12;
const float ENV_A2 = 1.08;

void main() {
  vec3 local = position;

  
  float phase = aPhase + uTime * TWO_PI * uBeatHz * aSwim;
  float k = TWO_PI / uWavelength;
  float wave = sin(phase - aSpine * k);
  float carrier = cos(phase - aSpine * k);

  float envelope = ENV_A0 + ENV_A1 * aSpine + ENV_A2 * aSpine * aSpine;
  float envelopeSlope = ENV_A1 + 2.0 * ENV_A2 * aSpine;

  float lateral = uAmplitude * envelope * wave;
  float lateralSlope = uAmplitude * (envelopeSlope * wave - envelope * carrier * k);

  
  
  lateral += aTrait.x * aTrait.x * uAmplitude * 0.35 * sin(phase * 1.9 - aSpine * 9.0);

  local.x += lateral;

  
  
  float slopeZ = -lateralSlope;

  
  
  
  vec3 bent = normalize(vec3(normal.x, normal.y, normal.z - slopeZ * normal.x));

  #ifdef USE_INSTANCING
    vec4 world = modelMatrix * instanceMatrix * vec4(local, 1.0);
    vec3 worldNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * bent);
  #else
    vec4 world = modelMatrix * vec4(local, 1.0);
    vec3 worldNormal = normalize(mat3(modelMatrix) * bent);
  #endif

  vWorldPosition = world.xyz;
  vNormal = worldNormal;
  vUv = uv;
  vTrait = aTrait;
  vLocal = local;
  vVariation = aVariation;
  vViewDistance = distance(world.xyz, cameraPosition);

  gl_Position = projectionMatrix * viewMatrix * world;
}`,kh=`precision highp float;

#ifndef ENDLESS_FISHING_WORLDLIGHT\r
#define ENDLESS_FISHING_WORLDLIGHT

#ifndef ENDLESS_FISHING_CONSTANTS\r
#define ENDLESS_FISHING_CONSTANTS

const float PI = 3.14159265358979323846;\r
const float TWO_PI = 6.28318530717958647692;\r
const float HALF_PI = 1.57079632679489661923;\r
const float INV_PI = 0.31830988618379067154;\r
const float INV_FOUR_PI = 0.07957747154594766788;\r
const float DEG_TO_RAD = 0.01745329251994329577;\r
const float RAD_TO_DEG = 57.2957795130823208768;

const float EPS = 1e-6;

#ifndef saturate\r
float saturate(float x) { return clamp(x, 0.0, 1.0); }\r
vec2 saturate(vec2 x) { return clamp(x, 0.0, 1.0); }\r
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }\r
#endif

float ef_luminance(vec3 colour) {\r
  return dot(colour, vec3(0.2126, 0.7152, 0.0722));\r
}

float remap(float x, float lowIn, float highIn, float lowOut, float highOut) {\r
  float span = highIn - lowIn;\r
  float t = span == 0.0 ? step(lowIn, x) : (x - lowIn) / span;\r
  return lowOut + saturate(t) * (highOut - lowOut);\r
}

vec3 hdrClamp(vec3 colour) {\r
  vec3 safe;\r
  safe.x = colour.x == colour.x ? colour.x : 0.0;\r
  safe.y = colour.y == colour.y ? colour.y : 0.0;\r
  safe.z = colour.z == colour.z ? colour.z : 0.0;\r
  
  
  return clamp(safe, vec3(0.0), vec3(60000.0));\r
}

float hdrClampAlpha(float alpha) {\r
  return clamp(alpha == alpha ? alpha : 0.0, 0.0, 1.0);\r
}

#endif\r
#ifndef ENDLESS_FISHING_AIRLIGHT\r
#define ENDLESS_FISHING_AIRLIGHT

vec3 ef_airLight(samplerCube environment, float intensity, vec3 V) {\r
  vec3 direction = normalize(vec3(-V.x, max(-V.y, 0.07), -V.z) + vec3(EPS, 0.0, 0.0));\r
  return textureCubeLodEXT(environment, direction, 1.0).rgb * intensity;\r
}

#endif

uniform vec3 uSunDirection;\r
uniform vec3 uSunColour;

uniform float uSunIlluminance;\r
uniform vec3 uMoonDirection;\r
uniform vec3 uMoonColour;\r
uniform float uMoonIlluminance;

uniform samplerCube uEnvironment;\r
uniform float uEnvironmentIntensity;

uniform float uVisibility;

float ef_ggx(float nDotH, float roughness) {\r
  float a = roughness * roughness;\r
  float a2 = a * a;\r
  float d = nDotH * nDotH * (a2 - 1.0) + 1.0;\r
  return a2 / max(EPS, PI * d * d);\r
}

float ef_smith(float nDotV, float nDotL, float roughness) {\r
  float k = roughness * roughness * 0.5;\r
  return (nDotV / (nDotV * (1.0 - k) + k)) * (nDotL / (nDotL * (1.0 - k) + k));\r
}

vec3 ef_fresnel(float cosTheta, vec3 f0) {\r
  float m = clamp(1.0 - cosTheta, 0.0, 1.0);\r
  float m2 = m * m;\r
  return f0 + (1.0 - f0) * m2 * m2 * m;\r
}

vec3 ef_directLight(\r
    vec3 L, vec3 colour, float illuminance,\r
    vec3 N, vec3 V, vec3 albedo, vec3 f0, float roughness) {\r
  if (illuminance <= 0.0) return vec3(0.0);

  float nDotL = dot(N, L);\r
  if (nDotL <= 0.0) return vec3(0.0);

  float horizon = smoothstep(-0.035, 0.02, L.y);\r
  if (horizon <= 0.0) return vec3(0.0);

  float nDotV = max(1e-3, dot(N, V));\r
  vec3 H = normalize(L + V);\r
  float nDotH = max(0.0, dot(N, H));

  float D = ef_ggx(nDotH, roughness);\r
  float G = ef_smith(nDotV, nDotL, roughness);\r
  vec3 F = ef_fresnel(max(0.0, dot(H, V)), f0);\r
  vec3 specular = (D * G / (4.0 * nDotV * nDotL + EPS)) * F;

  return colour * illuminance * nDotL * horizon * (albedo * INV_PI * (1.0 - F) + specular);\r
}

vec3 ef_shadeSurface(vec3 albedo, vec3 N, vec3 V, float roughness, float occlusion, vec3 f0) {\r
  vec3 colour = vec3(0.0);\r
  colour += ef_directLight(uSunDirection, uSunColour, uSunIlluminance, N, V, albedo, f0, roughness);\r
  colour += ef_directLight(uMoonDirection, uMoonColour, uMoonIlluminance, N, V, albedo, f0, roughness);

  
  
  
  vec3 irradiance = textureCubeLodEXT(uEnvironment, N, 6.0).rgb * uEnvironmentIntensity;\r
  vec3 R = reflect(-V, N);\r
  vec3 reflection = textureCubeLodEXT(uEnvironment, R, roughness * 7.0).rgb * uEnvironmentIntensity;

  float nDotV = max(1e-3, dot(N, V));\r
  vec3 F = ef_fresnel(nDotV, f0);\r
  colour += albedo * irradiance * occlusion;\r
  colour += reflection * F * occlusion;

  return colour;\r
}

vec3 ef_aerialPerspective(vec3 colour, float distanceToCamera, vec3 V) {\r
  float extinction = 3.912 / max(200.0, uVisibility);\r
  float t = 1.0 - exp(-extinction * distanceToCamera);\r
  return mix(colour, ef_airLight(uEnvironment, uEnvironmentIntensity, V), t);\r
}

#endif

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec2 vTrait;
varying vec3 vLocal;
varying float vVariation;
varying float vViewDistance;

uniform sampler2D uScales;

uniform vec2 uScaleRepeat;
uniform vec3 uBackColour;
uniform vec3 uBellyColour;

uniform float uIridescence;

uniform float uWaterLevel;

uniform float uTurbidity;

const vec3 ABSORPTION_OCEANIC = vec3(0.42, 0.072, 0.028);
const vec3 ABSORPTION_COASTAL = vec3(0.56, 0.19, 0.31);
const vec3 SCATTER_OCEANIC = vec3(0.010, 0.038, 0.055);
const vec3 SCATTER_COASTAL = vec3(0.028, 0.062, 0.048);

float submergedPath(vec3 fragPosition, vec3 eye, float level) {
  float fragBelow = max(0.0, level - fragPosition.y);
  float eyeBelow = max(0.0, level - eye.y);
  if (fragBelow <= 0.0 && eyeBelow <= 0.0) return 0.0;

  float total = distance(eye, fragPosition);
  if (fragBelow > 0.0 && eyeBelow > 0.0) return total;
  return total * ((fragBelow + eyeBelow) / max(EPS, abs(eye.y - fragPosition.y)));
}

vec3 thinFilm(float shift) {
  vec3 spectrum = 0.5 + 0.5 * cos(TWO_PI * (shift + vec3(0.0, 0.34, 0.67)));
  return mix(vec3(1.0), spectrum, 0.55);
}

void main() {
  
  
  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 viewVector = cameraPosition - vWorldPosition;
  vec3 V = viewVector / max(EPS, vViewDistance);

  vec2 scaleUv = vUv * uScaleRepeat;
  vec4 scales = texture2D(uScales, scaleUv);

  
  
  
  
  
  
  
  
  
  vec2 texel = 1.0 / max(vec2(1.0), uScaleRepeat * 128.0);
  float hx = texture2D(uScales, scaleUv + vec2(texel.x, 0.0)).r - scales.r;
  float hy = texture2D(uScales, scaleUv + vec2(0.0, texel.y)).r - scales.r;
  
  
  float relief = (1.0 - smoothstep(3.0, 16.0, vViewDistance)) * 0.7;
  N = normalize(N + vec3(hx, hy, 0.0) * relief * 6.0);

  
  
  
  float upness = smoothstep(-0.55, 0.72, N.y);
  vec3 albedo = mix(uBackColour, uBellyColour, upness);

  
  float flank = pow(abs(sin(vUv.x * TWO_PI)), 2.2);
  
  
  float alongBody = 0.5 - vLocal.z;
  float lineBand = smoothstep(0.94, 1.0, abs(sin(vUv.x * TWO_PI)));
  float lineRun = smoothstep(0.14, 0.24, alongBody) * (1.0 - smoothstep(0.72, 0.86, alongBody));
  albedo *= 1.0 - 0.3 * lineBand * lineRun;

  
  
  float occlusion = mix(1.0, scales.g, 0.75);

  
  float nDotV = max(1e-3, dot(N, V));
  float shift = (1.0 - nDotV) * 1.9 + scales.b * 1.1 + vVariation * 0.4;
  vec3 sheen = thinFilm(shift);
  
  float sheenAmount = uIridescence * flank * pow(1.0 - nDotV, 1.6) * 0.55;
  albedo = mix(albedo, albedo * sheen + sheen * 0.14, sheenAmount);

  
  
  
  
  float roughness = mix(0.34, 0.13, flank) * (0.85 + 0.3 * scales.a);
  vec3 f0 = vec3(0.045);

  
  
  float eye = vTrait.y;
  albedo = mix(albedo, vec3(0.012, 0.013, 0.015), eye);
  roughness = mix(roughness, 0.04, eye);
  occlusion = mix(occlusion, 1.0, eye);
  f0 = mix(f0, vec3(0.08), eye);

  
  float finEdge = vTrait.x;
  albedo = mix(albedo, mix(albedo, vec3(0.34, 0.35, 0.33), 0.55), finEdge);
  roughness = mix(roughness, 0.42, finEdge * 0.7);

  vec3 colour = ef_shadeSurface(albedo, N, V, roughness, occlusion, f0);

  
  
  float backlight = pow(max(0.0, dot(V, -uSunDirection)), 3.0);
  colour += uSunColour * uSunIlluminance * backlight * finEdge * 0.35 * albedo;

  
  vec3 absorption = mix(ABSORPTION_OCEANIC, ABSORPTION_COASTAL, uTurbidity);
  vec3 scatterColour = mix(SCATTER_OCEANIC, SCATTER_COASTAL, uTurbidity);

  
  
  
  float depthBelow = max(0.0, uWaterLevel - vWorldPosition.y);
  vec3 downwelling = exp(-absorption * (depthBelow / 0.66));
  colour *= downwelling;

  
  float path = submergedPath(vWorldPosition, cameraPosition, uWaterLevel);
  vec3 transmittance = exp(-absorption * path);
  
  
  
  vec3 skyAbove = textureCubeLodEXT(uEnvironment, vec3(0.0, 1.0, 0.0), 5.0).rgb * uEnvironmentIntensity;
  vec3 sunlight = uSunColour * uSunIlluminance + uMoonColour * uMoonIlluminance;
  vec3 inscatter =
      scatterColour * (skyAbove * 0.55 + sunlight * 0.35 * max(0.0, uSunDirection.y)) * downwelling;
  colour = colour * transmittance + inscatter * (1.0 - transmittance);

  
  
  colour = ef_aerialPerspective(colour, max(0.0, vViewDistance - path), V);

  gl_FragColor = vec4(hdrClamp(colour), 1.0);
}`,Ah=192,jh=2,Mh=34,Nh=130,Ph=210,Fh=1.4,Ih=8;function Lh(e){return G(1-Math.log10(e.maxMassKg+1)/1.9,.05,1)}function Rh(e,t){let n=Math.max(.1,t),r=Lh(e),i=n*(1.1+.7*r);return{neighbourRadius:n*7,separationRadius:n*(1.5+1.6*(1-r)),separationWeight:2.6,alignmentWeight:1.5*r+.25,cohesionWeight:.9*r+.08,wanderWeight:i*.5,homeRadius:22+90*r,homeWeight:i*.9,depthWeight:.55,depthSpread:n*(4+16*r),baitRadius:26,baitWeight:i*1.6,fleeWeight:i*5,cruiseSpeed:i,maxSpeed:i*2.6,maxAcceleration:i*4.5,surfaceClearance:.6+n,floorClearance:.35+n*.6}}var zh=class{capacity;positions;velocities;phases;beats;variation;banks;lengths;accelerations;species=null;tuning=null;count=0;homeX=0;homeY=0;homeZ=0;holdY=0;age=0;centroidX=0;centroidY=0;centroidZ=0;spread=0;nearestNeighbourMean=0;constructor(e){this.capacity=e,this.positions=new Float32Array(e*3),this.velocities=new Float32Array(e*3),this.phases=new Float32Array(e),this.beats=new Float32Array(e),this.variation=new Float32Array(e),this.banks=new Float32Array(e),this.lengths=new Float32Array(e),this.accelerations=new Float32Array(e*3)}get active(){return this.species!==null&&this.count>0}spawn(e,t,n,r,i,a){let o=Rh(e,(e.minLengthM+e.maxLengthM)*.5);this.species=e,this.tuning=o,this.count=Math.min(t,this.capacity),this.homeX=n,this.homeY=r,this.homeZ=i,this.holdY=r,this.age=0;let s=a.next()*Math.PI*2,c=o.separationRadius*Math.cbrt(this.count)*1.1;for(let t=0;t<this.count;t+=1){let l=t*3;this.positions[l]=n+a.range(-c,c),this.positions[l+1]=r+a.range(-c,c)*.4,this.positions[l+2]=i+a.range(-c,c);let u=s+a.range(-.35,.35),d=o.cruiseSpeed*a.range(.8,1.2);this.velocities[l]=Math.sin(u)*d,this.velocities[l+1]=a.range(-.1,.1)*d,this.velocities[l+2]=Math.cos(u)*d,this.phases[t]=a.next()*Math.PI*2,this.beats[t]=a.range(.85,1.2),this.variation[t]=a.next(),this.banks[t]=0;let f=G(a.gaussian(.3,.22),0,1);this.lengths[t]=e.minLengthM+(e.maxLengthM-e.minLengthM)*f}this.spread=0,this.nearestNeighbourMean=0,this.measure(this.count)}retire(){this.species=null,this.tuning=null,this.count=0}step(e,t){let n=this.count,r=this.tuning;n!==0&&r!==null&&(this.age+=e,this.accumulate(n,r,t),this.integrate(e,n,r),this.measure(n))}accumulate(e,t,n){let r=this.positions,i=this.velocities,a=this.accelerations,o=t.neighbourRadius*t.neighbourRadius,s=t.separationRadius*t.separationRadius,c=t.baitRadius*t.baitRadius,l=n.hullRadius*n.hullRadius,u=n.surfaceY-t.surfaceClearance,d=n.floorY+t.floorClearance,f=0,p=0;for(let m=0;m<e;m+=1){let h=m*3,g=r[h]??0,_=r[h+1]??0,v=r[h+2]??0,y=i[h]??0,b=i[h+1]??0,x=i[h+2]??0,S=0,C=0,w=0,T=0,E=0,D=0,O=0,ee=0,k=0,te=0,A=1/0;for(let n=0;n<e;n+=1){if(n===m)continue;let e=n*3,a=r[e]??0,c=r[e+1]??0,l=r[e+2]??0,u=g-a,d=_-c,p=v-l,h=u*u+d*d+p*p;if(f+=h,h<A&&(A=h),h>o||(te+=1,O+=a,ee+=c,k+=l,T+=i[e]??0,E+=i[e+1]??0,D+=i[e+2]??0,h>=s))continue;let y=Math.sqrt(h),b=(1-y/t.separationRadius)/Math.max(y,.001);S+=u*b,C+=d*b,w+=p*b}p+=A===1/0?0:Math.sqrt(A);let j=S*t.separationWeight,M=C*t.separationWeight,N=w*t.separationWeight;if(te>0){let e=1/te;j+=(T*e-y)*t.alignmentWeight,M+=(E*e-b)*t.alignmentWeight,N+=(D*e-x)*t.alignmentWeight,j+=(O*e-g)*t.cohesionWeight,M+=(ee*e-_)*t.cohesionWeight,N+=(k*e-v)*t.cohesionWeight}let ne=this.phases[m]??0;j+=Math.sin(this.age*.31+ne)*t.wanderWeight,M+=Math.sin(this.age*.23+ne*1.7)*t.wanderWeight*.3,N+=Math.cos(this.age*.27+ne*2.3)*t.wanderWeight;let P=this.holdY+((this.variation[m]??.5)-.5)*t.depthSpread;M+=(P-_)*t.depthWeight,_>u&&(M-=(_-u)*4),_<d&&(M+=(d-_)*4);let re=g-this.homeX,ie=v-this.homeZ,ae=Math.hypot(re,ie);if(ae>t.homeRadius){let e=t.homeWeight*(ae/t.homeRadius-1)/ae;j-=re*e,N-=ie*e}if(n.baitPull>0){let e=n.baitX-g,r=n.baitY-_,i=n.baitZ-v,a=e*e+r*r+i*i;if(a<c){let o=Math.max(.2,Math.sqrt(a)),s=n.baitPull*t.baitWeight*(1-o/t.baitRadius)/o;j+=e*s,M+=r*s,N+=i*s}}if(l>0){let e=g-n.hullX,r=_-n.hullY,i=v-n.hullZ,a=e*e+r*r+i*i;if(a<l){let o=Math.max(.2,Math.sqrt(a)),s=1-o/n.hullRadius,c=t.fleeWeight*s*s/o;j+=e*c,M+=r*c,N+=i*c}}a[h]=j,a[h+1]=M,a[h+2]=N}this.spread=e<2?0:Math.sqrt(f/(e*(e-1))),this.nearestNeighbourMean=p/e}integrate(e,t,n){let r=this.positions,i=this.velocities,a=this.accelerations,o=n.cruiseSpeed*.3,s=n.maxSpeed*n.maxSpeed,c=o*o,l=n.maxAcceleration*n.maxAcceleration;for(let u=0;u<t;u+=1){let t=u*3,d=a[t]??0,f=a[t+1]??0,p=a[t+2]??0,m=d*d+f*f+p*p;if(m>l){let e=n.maxAcceleration/Math.sqrt(m);d*=e,f*=e,p*=e}let h=(i[t]??0)+d*e,g=(i[t+1]??0)+f*e,_=(i[t+2]??0)+p*e,v=h*h+g*g+_*_;if(v>s){let e=n.maxSpeed/Math.sqrt(v);h*=e,g*=e,_*=e}else if(v<c){let e=Math.sqrt(v);if(e<1e-5){let e=this.phases[u]??0;h=Math.sin(e)*o,g=0,_=Math.cos(e)*o}else{let t=o/e;h*=t,g*=t,_*=t}}i[t]=h,i[t+1]=g,i[t+2]=_,r[t]=(r[t]??0)+h*e,r[t+1]=(r[t+1]??0)+g*e,r[t+2]=(r[t+2]??0)+_*e;let y=Math.hypot(h,_);if(y>1e-4){let t=(d*_-p*h)/y;this.banks[u]=K(this.banks[u]??0,G(t*.14,-.75,.75),6,e)}}}measure(e){if(e===0)return;let t=this.positions,n=0,r=0,i=0;for(let a=0;a<e;a+=1)n+=t[a*3]??0,r+=t[a*3+1]??0,i+=t[a*3+2]??0;this.centroidX=n/e,this.centroidY=r/e,this.centroidZ=i/e}},Bh=new b,Vh=new t,Hh=new t,Uh=new t,Wh=new t,Gh=new t(0,1,0),Kh={depthM:20,sunAltitudeDeg:0,beaufort:3,waterTemperatureC:10,bait:`bare`,rarity:0},qh=class{name=`fish`;priority=30;water;ground;hull;renders=[];schools=[];rng;weights=[];environment={baitX:0,baitY:0,baitZ:0,baitPull:0,hullX:0,hullY:0,hullZ:0,hullRadius:0,surfaceY:0,floorY:-55};optics=null;spawnTimer=0;schoolSize;targetSchools;constructor(e,t,n,r){this.water=t,this.ground=n,this.hull=r,this.rng=new H(e.settings.world.seed^7957);let i=e.settings.graphics;this.schoolSize=i.schoolSize,this.targetSchools=Jh(i.instanceDensity);for(let t of th){let n=Yh(e,t);this.renders.push(n),this.weights.push(0),e.scene.add(n.mesh)}let a=Ah/jh;for(let e=0;e<th.length*jh;e+=1)this.schools.push(new zh(a))}setOptics(e){this.optics=e}setBait(e,t,n,r){this.environment.baitX=e,this.environment.baitY=t,this.environment.baitZ=n,this.environment.baitPull=G(r,0,1)}clearBait(){this.environment.baitPull=0}nearestSchool(e,t){t.distanceM=1/0,t.species=null,t.count=0,t.depthM=0;for(let n of this.schools){if(!n.active)continue;let r=this.edgeDistance(n,e);r>=t.distanceM||(t.distanceM=r,t.species=n.species,t.count=n.count,t.depthM=Math.max(0,this.environment.surfaceY-n.centroidY))}return t}schoolBoost(e){let t=0;for(let n of this.schools){if(!n.active)continue;let r=G(n.count/Math.max(1,this.schoolSize),.15,1);t=Math.max(t,Math.exp(-this.edgeDistance(n,e)/9)*r)}return t}update(e,t){let n=t.camera.position,r=this.environment;r.surfaceY=this.water.heightAt(n.x,n.z),r.floorY=this.ground.floorHeightAt(n.x,n.z),this.hull!==null&&(r.hullX=this.hull.position.x,r.hullY=this.hull.position.y,r.hullZ=this.hull.position.z,r.hullRadius=Ih),this.stream(e,t,n);let i=Math.min(e,1/20);for(let e of this.schools)e.step(i,r);this.writeInstances()}beforeRender(e){let t=ko(e),n=this.optics?.turbidity;for(let r of this.renders){let i=r.material.uniforms;Ao(i,e,t);let a=i.uTime;a!==void 0&&(a.value=e.loop.elapsed);let o=i.uWaterLevel;o!==void 0&&(o.value=this.environment.surfaceY);let s=i.uTurbidity;s!==void 0&&n!==void 0&&(s.value=n)}}onSettingsChanged(e){let t=e.settings.graphics;this.schoolSize=t.schoolSize,this.targetSchools=Jh(t.instanceDensity)}dispose(){for(let e of this.renders)e.geometry.dispose(),e.material.dispose(),e.mesh.dispose();this.renders.length=0,this.schools.length=0}edgeDistance(e,t){let n=e.centroidX-t.x,r=e.centroidY-t.y,i=e.centroidZ-t.z;return Math.max(0,Math.hypot(n,r,i)-e.spread*.5)}stream(e,t,n){let r=0;for(let e of this.schools)e.active&&(Math.hypot(e.centroidX-n.x,e.centroidZ-n.z)>Ph?e.retire():r+=1);if(this.spawnTimer-=e,r>=this.targetSchools||this.spawnTimer>0)return;this.spawnTimer=Fh;let i=this.rng.next()*Math.PI*2,a=this.rng.range(Mh,Nh),o=n.x+Math.sin(i)*a,s=n.z+Math.cos(i)*a,c=this.water.heightAt(o,s),l=Math.max(2,c-this.ground.floorHeightAt(o,s)),u=this.chooseSpecies(t,l);if(u===void 0)return;let d=this.freeSlot(u);if(d===void 0)return;let f=G(this.rng.range(u.minDepthM,u.maxDepthM),1.5,Math.max(2,l-1.5)),p=Math.max(1,Math.round(this.schoolSize*Lh(u)));d.spawn(u,p,o,c-f,s,this.rng),d.holdY-=Math.min(6,t.world.beaufort*.5)}chooseSpecies(e,t){let n=e.world,r=n.ephemeris;Kh.depthM=G(t*.6,1,400),Kh.sunAltitudeDeg=r===null?10:r.sunAltitudeDeg,Kh.beaufort=n.beaufort,Kh.waterTemperatureC=n.temperatureC,Kh.rarity=0;let i=0;for(let e=0;e<th.length;e+=1){let t=th[e];if(t===void 0)continue;Kh.bait=t.baits[0]??`bare`;let n=t.weight*rh(t,Kh);this.weights[e]=n,i+=n}if(i<=0)return;let a=this.rng.weightedIndex(this.weights);return a<0?void 0:th[a]}freeSlot(e){let t=0,n;for(let r of this.schools)r.active?r.species===e&&(t+=1):n===void 0&&(n=r);return t>=jh?void 0:n}writeInstances(){for(let e of this.renders){let t=0;for(let n of this.schools)if(!(n.species!==e.species||!n.active))for(let r=0;r<n.count&&t<Ah;r+=1){let i=r*3;Vh.set(n.velocities[i]??0,n.velocities[i+1]??0,n.velocities[i+2]??1);let a=Vh.length();a<1e-5?Vh.set(0,0,1):Vh.multiplyScalar(1/a),Uh.copy(Gh).applyAxisAngle(Vh,n.banks[r]??0),Hh.crossVectors(Uh,Vh),Hh.lengthSq()<1e-8&&Hh.set(1,0,0),Hh.normalize(),Uh.crossVectors(Vh,Hh);let o=n.lengths[r]??.3;Wh.set(o,o,o),Bh.makeBasis(Hh,Uh,Vh),Bh.scale(Wh),Bh.setPosition(n.positions[i]??0,n.positions[i+1]??0,n.positions[i+2]??0),e.mesh.setMatrixAt(t,Bh),e.phaseData[t]=n.phases[r]??0,e.swimData[t]=(n.beats[r]??1)*(.55+a/e.cruiseSpeed),e.variationData[t]=n.variation[r]??0,t+=1}e.mesh.count=t,e.mesh.visible=t>0,t!==0&&(e.mesh.instanceMatrix.needsUpdate=!0,e.phase.needsUpdate=!0,e.swim.needsUpdate=!0,e.variation.needsUpdate=!0)}}};function Jh(e){return Math.max(3,Math.round(3+7*G(e,0,1)))}function Yh(e,t){let n=Dh(t),r=e.resources.track(Vr(128,t.scaleDensity,t.iridescence,Xh(t.id))),o=new i({name:`fish:${t.id}`,vertexShader:Oh,fragmentShader:kh,uniforms:{...Oo(),uTime:{value:0},uBeatHz:{value:2.4},uAmplitude:{value:.085},uWavelength:{value:1.05},uScales:{value:r},uScaleRepeat:{value:new x(1,2)},uBackColour:{value:new a(t.backColour[0],t.backColour[1],t.backColour[2])},uBellyColour:{value:new a(t.bellyColour[0],t.bellyColour[1],t.bellyColour[2])},uIridescence:{value:t.iridescence},uWaterLevel:{value:0},uTurbidity:{value:.32}},side:2}),c=new s(n,o,Ah);c.name=`fish:${t.id}`,c.count=0,c.visible=!1,c.frustumCulled=!1;let l=new Float32Array(Ah),u=new Float32Array(Ah),d=new Float32Array(Ah),f=new w(l,1),p=new w(u,1),m=new w(d,1);return n.setAttribute(`aPhase`,f),n.setAttribute(`aSwim`,p),n.setAttribute(`aVariation`,m),{species:t,geometry:n,material:o,mesh:c,phase:f,swim:p,variation:m,phaseData:l,swimData:u,variationData:d,cruiseSpeed:Math.max(.1,Rh(t,(t.minLengthM+t.maxLengthM)*.5).cruiseSpeed)}}function Xh(e){let t=2166136261;for(let n=0;n<e.length;n+=1)t=Math.imul(t^e.charCodeAt(n),16777619)>>>0;return t}function Zh(){return{position:[],normal:[],uv:[],wing:[],index:[]}}function Qh(e,t){let n=new L;if(n.setAttribute(`position`,new j(new Float32Array(e.position),3)),n.setAttribute(`normal`,new j(new Float32Array(e.normal),3)),n.setAttribute(`uv`,new j(new Float32Array(e.uv),2)),n.setAttribute(`aWing`,new j(new Float32Array(e.wing),1)),!t){let t=new Float32Array(e.wing.length);n.setAttribute(`aPhase`,new j(t,1)),n.setAttribute(`aRate`,new j(t,1)),n.setAttribute(`aAmplitude`,new j(t,1))}return n.setIndex(e.index),n.computeBoundingSphere(),n}function $h(e,t,n){let r=e.position.length/3;for(let r of t){let[t,i]=r;for(let r=0;r<=n;r+=1){let a=r/n*Math.PI*2,o=Math.cos(a),s=Math.sin(a);e.position.push(o*i,s*i,t),e.normal.push(o,s,0),e.uv.push(r/n,s*.5+.5),e.wing.push(0)}}let i=n+1;for(let a=0;a<t.length-1;a+=1)for(let t=0;t<n;t+=1){let n=r+a*i+t,o=n+1,s=n+i,c=s+1;e.index.push(n,s,o,o,s,c)}}function eg(e,t,n,r,i){let a=e.position.length/3,o=[0,0,0];for(let a=0;a<4;a+=1){let s=t[a]??o;e.position.push(s[0],s[1],s[2]),e.normal.push(r[0],r[1],r[2]),e.uv.push(a<2?0:1,i),e.wing.push(n[a]??0)}e.index.push(a,a+1,a+2,a,a+2,a+3)}function tg(){let e=Zh();$h(e,[[-.26,.012],[-.16,.048],[-.02,.062],[.12,.05],[.22,.026],[.29,.008]],8);let t=.7;for(let n of[-1,1])eg(e,[[.03*n,.015,-.09],[.03*n,.015,.1],[t*n,.015,.03],[t*n,.015,-.04]],[.04*n,.04*n,n,n],[0,1,0],.74);return eg(e,[[-.05,.012,.2],[.05,.012,.2],[.07,.012,.32],[-.07,.012,.32]],[0,0,0,0],[0,1,0],.7),Qh(e,!0)}function ng(){let e=Zh();return $h(e,[[-.5,.01],[-.34,.055],[-.1,.098],[.14,.088],[.34,.045],[.5,.012]],10),eg(e,[[0,.08,-.12],[0,.08,.02],[0,.2,-.02],[0,.19,-.11]],[0,0,0,0],[1,0,0],.95),eg(e,[[-.22,0,-.62],[.22,0,-.62],[.05,0,-.44],[-.05,0,-.44]],[0,0,0,0],[0,1,0],.85),Qh(e,!1)}function rg(){let e=new y(.55,3.4,10,4,!0);e.translate(0,1.7,0);let t=e.getAttribute(`position`),n=new Float32Array(t.count*4);for(let e=0;e<t.count;e+=1){let r=G(t.getY(e)/3.4,0,1),i=(1-r)**1.6*(.35+.65*r);n[e*4]=.92,n[e*4+1]=.95,n[e*4+2]=1,n[e*4+3]=i}return e.setAttribute(`color`,new j(n,4)),e.computeBoundingSphere(),e}var ig=`precision highp float;

#ifndef ENDLESS_FISHING_CONSTANTS\r
#define ENDLESS_FISHING_CONSTANTS

const float PI = 3.14159265358979323846;\r
const float TWO_PI = 6.28318530717958647692;\r
const float HALF_PI = 1.57079632679489661923;\r
const float INV_PI = 0.31830988618379067154;\r
const float INV_FOUR_PI = 0.07957747154594766788;\r
const float DEG_TO_RAD = 0.01745329251994329577;\r
const float RAD_TO_DEG = 57.2957795130823208768;

const float EPS = 1e-6;

#ifndef saturate\r
float saturate(float x) { return clamp(x, 0.0, 1.0); }\r
vec2 saturate(vec2 x) { return clamp(x, 0.0, 1.0); }\r
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }\r
#endif

float ef_luminance(vec3 colour) {\r
  return dot(colour, vec3(0.2126, 0.7152, 0.0722));\r
}

float remap(float x, float lowIn, float highIn, float lowOut, float highOut) {\r
  float span = highIn - lowIn;\r
  float t = span == 0.0 ? step(lowIn, x) : (x - lowIn) / span;\r
  return lowOut + saturate(t) * (highOut - lowOut);\r
}

vec3 hdrClamp(vec3 colour) {\r
  vec3 safe;\r
  safe.x = colour.x == colour.x ? colour.x : 0.0;\r
  safe.y = colour.y == colour.y ? colour.y : 0.0;\r
  safe.z = colour.z == colour.z ? colour.z : 0.0;\r
  
  
  return clamp(safe, vec3(0.0), vec3(60000.0));\r
}

float hdrClampAlpha(float alpha) {\r
  return clamp(alpha == alpha ? alpha : 0.0, 0.0, 1.0);\r
}

#endif

attribute float aWing;

attribute float aPhase;

attribute float aRate;
attribute float aAmplitude;

uniform float uTime;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vSpan;
varying float vViewDistance;

void main() {
  float span = abs(aWing);
  float stroke = aAmplitude * sin(uTime * aRate + aPhase) * span * span;
  float angle = aWing >= 0.0 ? stroke : -stroke;

  float s = sin(angle);
  float c = cos(angle);
  vec3 local = vec3(position.x * c - position.y * s, position.x * s + position.y * c, position.z);
  vec3 localNormal = vec3(normal.x * c - normal.y * s, normal.x * s + normal.y * c, normal.z);

  #ifdef USE_INSTANCING
    vec4 world = modelMatrix * instanceMatrix * vec4(local, 1.0);
    vec3 worldNormal = mat3(modelMatrix) * mat3(instanceMatrix) * localNormal;
  #else
    vec4 world = modelMatrix * vec4(local, 1.0);
    vec3 worldNormal = mat3(modelMatrix) * localNormal;
  #endif

  vWorldPosition = world.xyz;
  vNormal = normalize(worldNormal);
  vUv = uv;
  vSpan = span;
  vViewDistance = distance(world.xyz, cameraPosition);

  gl_Position = projectionMatrix * viewMatrix * world;
}`,ag=`precision highp float;

#ifndef ENDLESS_FISHING_WORLDLIGHT\r
#define ENDLESS_FISHING_WORLDLIGHT

#ifndef ENDLESS_FISHING_CONSTANTS\r
#define ENDLESS_FISHING_CONSTANTS

const float PI = 3.14159265358979323846;\r
const float TWO_PI = 6.28318530717958647692;\r
const float HALF_PI = 1.57079632679489661923;\r
const float INV_PI = 0.31830988618379067154;\r
const float INV_FOUR_PI = 0.07957747154594766788;\r
const float DEG_TO_RAD = 0.01745329251994329577;\r
const float RAD_TO_DEG = 57.2957795130823208768;

const float EPS = 1e-6;

#ifndef saturate\r
float saturate(float x) { return clamp(x, 0.0, 1.0); }\r
vec2 saturate(vec2 x) { return clamp(x, 0.0, 1.0); }\r
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }\r
#endif

float ef_luminance(vec3 colour) {\r
  return dot(colour, vec3(0.2126, 0.7152, 0.0722));\r
}

float remap(float x, float lowIn, float highIn, float lowOut, float highOut) {\r
  float span = highIn - lowIn;\r
  float t = span == 0.0 ? step(lowIn, x) : (x - lowIn) / span;\r
  return lowOut + saturate(t) * (highOut - lowOut);\r
}

vec3 hdrClamp(vec3 colour) {\r
  vec3 safe;\r
  safe.x = colour.x == colour.x ? colour.x : 0.0;\r
  safe.y = colour.y == colour.y ? colour.y : 0.0;\r
  safe.z = colour.z == colour.z ? colour.z : 0.0;\r
  
  
  return clamp(safe, vec3(0.0), vec3(60000.0));\r
}

float hdrClampAlpha(float alpha) {\r
  return clamp(alpha == alpha ? alpha : 0.0, 0.0, 1.0);\r
}

#endif\r
#ifndef ENDLESS_FISHING_AIRLIGHT\r
#define ENDLESS_FISHING_AIRLIGHT

vec3 ef_airLight(samplerCube environment, float intensity, vec3 V) {\r
  vec3 direction = normalize(vec3(-V.x, max(-V.y, 0.07), -V.z) + vec3(EPS, 0.0, 0.0));\r
  return textureCubeLodEXT(environment, direction, 1.0).rgb * intensity;\r
}

#endif

uniform vec3 uSunDirection;\r
uniform vec3 uSunColour;

uniform float uSunIlluminance;\r
uniform vec3 uMoonDirection;\r
uniform vec3 uMoonColour;\r
uniform float uMoonIlluminance;

uniform samplerCube uEnvironment;\r
uniform float uEnvironmentIntensity;

uniform float uVisibility;

float ef_ggx(float nDotH, float roughness) {\r
  float a = roughness * roughness;\r
  float a2 = a * a;\r
  float d = nDotH * nDotH * (a2 - 1.0) + 1.0;\r
  return a2 / max(EPS, PI * d * d);\r
}

float ef_smith(float nDotV, float nDotL, float roughness) {\r
  float k = roughness * roughness * 0.5;\r
  return (nDotV / (nDotV * (1.0 - k) + k)) * (nDotL / (nDotL * (1.0 - k) + k));\r
}

vec3 ef_fresnel(float cosTheta, vec3 f0) {\r
  float m = clamp(1.0 - cosTheta, 0.0, 1.0);\r
  float m2 = m * m;\r
  return f0 + (1.0 - f0) * m2 * m2 * m;\r
}

vec3 ef_directLight(\r
    vec3 L, vec3 colour, float illuminance,\r
    vec3 N, vec3 V, vec3 albedo, vec3 f0, float roughness) {\r
  if (illuminance <= 0.0) return vec3(0.0);

  float nDotL = dot(N, L);\r
  if (nDotL <= 0.0) return vec3(0.0);

  float horizon = smoothstep(-0.035, 0.02, L.y);\r
  if (horizon <= 0.0) return vec3(0.0);

  float nDotV = max(1e-3, dot(N, V));\r
  vec3 H = normalize(L + V);\r
  float nDotH = max(0.0, dot(N, H));

  float D = ef_ggx(nDotH, roughness);\r
  float G = ef_smith(nDotV, nDotL, roughness);\r
  vec3 F = ef_fresnel(max(0.0, dot(H, V)), f0);\r
  vec3 specular = (D * G / (4.0 * nDotV * nDotL + EPS)) * F;

  return colour * illuminance * nDotL * horizon * (albedo * INV_PI * (1.0 - F) + specular);\r
}

vec3 ef_shadeSurface(vec3 albedo, vec3 N, vec3 V, float roughness, float occlusion, vec3 f0) {\r
  vec3 colour = vec3(0.0);\r
  colour += ef_directLight(uSunDirection, uSunColour, uSunIlluminance, N, V, albedo, f0, roughness);\r
  colour += ef_directLight(uMoonDirection, uMoonColour, uMoonIlluminance, N, V, albedo, f0, roughness);

  
  
  
  vec3 irradiance = textureCubeLodEXT(uEnvironment, N, 6.0).rgb * uEnvironmentIntensity;\r
  vec3 R = reflect(-V, N);\r
  vec3 reflection = textureCubeLodEXT(uEnvironment, R, roughness * 7.0).rgb * uEnvironmentIntensity;

  float nDotV = max(1e-3, dot(N, V));\r
  vec3 F = ef_fresnel(nDotV, f0);\r
  colour += albedo * irradiance * occlusion;\r
  colour += reflection * F * occlusion;

  return colour;\r
}

vec3 ef_aerialPerspective(vec3 colour, float distanceToCamera, vec3 V) {\r
  float extinction = 3.912 / max(200.0, uVisibility);\r
  float t = 1.0 - exp(-extinction * distanceToCamera);\r
  return mix(colour, ef_airLight(uEnvironment, uEnvironmentIntensity, V), t);\r
}

#endif

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vSpan;
varying float vViewDistance;

uniform vec3 uUnderside;
uniform vec3 uMantle;
uniform vec3 uTip;

uniform float uTranslucency;
uniform float uRoughness;

void main() {
  vec3 viewVector = cameraPosition - vWorldPosition;
  vec3 V = viewVector / max(EPS, vViewDistance);

  vec3 N = normalize(vNormal);
  
  if (!gl_FrontFacing) N = -N;

  
  
  vec3 albedo = mix(uUnderside, uMantle, smoothstep(0.45, 0.85, vUv.y));
  albedo = mix(albedo, uTip, smoothstep(0.72, 0.98, vSpan));

  vec3 colour = ef_shadeSurface(albedo, N, V, clamp(uRoughness, 0.05, 1.0), 1.0, vec3(0.04));

  float through = pow(max(0.0, dot(V, -uSunDirection)), 3.0) * vSpan * uTranslucency;
  colour += albedo * uSunColour * uSunIlluminance * through * 1.4;

  colour = ef_aerialPerspective(colour, vViewDistance, V);

  gl_FragColor = vec4(hdrClamp(colour), 1.0);
}`,og=48,sg=260,cg=7,lg=9,ug=15,dg=7,fg=26,pg=3,mg=11,hg=1.7,gg=.55,_g=.32,vg=.95,yg=.7,bg=6,xg=2,Sg=[90,420],Cg=[650,1700],wg=[14,70],Tg=[70,260],Eg=1.5,Dg=7,Og=2.2,kg=6,Ag=new b,jg=new t,Mg=new t,Ng=new P,Pg=new P,Fg=new t(1,1,1),Ig=new t(1,1,1),Lg=new t,Rg=new t,zg=new t,Bg=new t,Vg=new t,Hg=new t(0,0,1),Ug=new t(0,0,1),Wg=class{name=`birds`;priority=22;engine;gullMaterial;cetaceanMaterial;spoutMaterial;gulls;dolphins;whales;spouts;velocity=new Float32Array(144);position=new Float32Array(144);amplitude;animals=new Float32Array(48);rng;sea=null;locator=null;flock=og;elapsed=0;constructor(e){this.engine=e,this.rng=new H(e.settings.world.seed^45357),this.gullMaterial=Kg(new a(.88,.885,.89),new a(.4,.44,.48),new a(.05,.05,.06),1,.55),this.cetaceanMaterial=Kg(new a(.58,.6,.59),new a(.1,.12,.13),new a(.08,.09,.1),0,.22);let t=tg();this.amplitude=new w(new Float32Array(og),1);let n=new w(new Float32Array(og),1),r=new w(new Float32Array(og),1);for(let e=0;e<og;e+=1)n.setX(e,this.rng.range(0,Math.PI*2)),r.setX(e,this.rng.range(17,23)),this.amplitude.setX(e,.5);t.setAttribute(`aPhase`,n),t.setAttribute(`aRate`,r),t.setAttribute(`aAmplitude`,this.amplitude),this.gulls=new s(t,this.gullMaterial,og),this.gulls.frustumCulled=!1;let i=ng();this.dolphins=new s(i,this.cetaceanMaterial,bg),this.whales=new s(i,this.cetaceanMaterial,xg),this.dolphins.frustumCulled=!1,this.whales.frustumCulled=!1,this.spoutMaterial=new ie({vertexColors:!0,transparent:!0,blending:2,depthWrite:!1,side:2,toneMapped:!1,opacity:.55}),this.spouts=new s(rg(),this.spoutMaterial,xg),this.spouts.frustumCulled=!1,e.scene.add(this.gulls,this.dolphins,this.whales,this.spouts),this.applyQuality(),this.scatter();for(let e=0;e<8;e+=1)this.reseat(e,!0)}setSea(e){this.sea=e}setSchoolLocator(e){this.locator=e}update(e,t){let n=Math.min(e,.05);this.elapsed+=n;let r=t.world,i=ko(t);Ao(this.gullMaterial.uniforms,t,i),Ao(this.cetaceanMaterial.uniforms,t,i),Gg(this.gullMaterial.uniforms,`uTime`,this.elapsed),Gg(this.cetaceanMaterial.uniforms,`uTime`,this.elapsed);let a=this.locator!==null&&this.locator(Vg);a||Vg.set(t.camera.position.x,this.waterAt(t.camera.position.x,t.camera.position.z),t.camera.position.z),this.steerFlock(n,r.windX,r.windZ,a),this.updateCetaceans(n,t)}onSettingsChanged(){this.applyQuality()}dispose(){this.engine.scene.remove(this.gulls,this.dolphins,this.whales,this.spouts),this.gulls.geometry.dispose(),this.dolphins.geometry.dispose(),this.spouts.geometry.dispose(),this.gulls.dispose(),this.dolphins.dispose(),this.whales.dispose(),this.spouts.dispose(),this.gullMaterial.dispose(),this.cetaceanMaterial.dispose(),this.spoutMaterial.dispose()}applyQuality(){this.flock=G(Math.round(og*this.engine.settings.graphics.instanceDensity),6,og),this.gulls.count=this.flock}scatter(){let e=this.engine.camera.position;for(let t=0;t<og;t+=1){let n=this.rng.range(0,Math.PI*2),r=this.rng.range(20,sg*.6);this.position[t*3]=e.x+Math.cos(n)*r,this.position[t*3+1]=this.rng.range(dg,fg),this.position[t*3+2]=e.z+Math.sin(n)*r;let i=this.rng.range(0,Math.PI*2);this.velocity[t*3]=Math.cos(i)*lg,this.velocity[t*3+1]=0,this.velocity[t*3+2]=Math.sin(i)*lg}}steerFlock(e,t,n,r){let i=r?pg:dg,a=r?mg:fg;for(let r=0;r<this.flock;r+=1){let o=r*3,s=this.position[o]??0,c=this.position[o+1]??0,l=this.position[o+2]??0;Rg.set(0,0,0),zg.set(0,0,0),Bg.set(0,0,0);let u=0;for(let e=0;e<this.flock;e+=1){if(e===r)continue;let t=e*3,n=(this.position[t]??0)-s,i=(this.position[t+1]??0)-c,a=(this.position[t+2]??0)-l,o=n*n+i*i+a*a;if(o>676||(u+=1,Bg.x+=n,Bg.y+=i,Bg.z+=a,Rg.x+=this.velocity[t]??0,Rg.y+=this.velocity[t+1]??0,Rg.z+=this.velocity[t+2]??0,o>49||o<1e-4))continue;let d=1/o;zg.x-=n*d,zg.y-=i*d,zg.z-=a*d}Lg.set(0,0,0),u>0&&(Lg.addScaledVector(zg,hg*cg),Lg.addScaledVector(Rg,gg/u),Lg.addScaledVector(Bg,_g/u));let d=Vg.x-s,f=Vg.z-l,p=Math.hypot(d,f)||1,m=G((p-30)/60,-.6,1);Lg.x+=(d/p*m-f/p*.8)*vg*lg,Lg.z+=(f/p*m+d/p*.8)*vg*lg;let h=this.waterAt(s,l),g=G(c,h+i,h+a);Lg.y+=(g-c)*yg;let _=(this.velocity[o]??0)+Lg.x*e,v=(this.velocity[o+1]??0)+Lg.y*e,y=(this.velocity[o+2]??0)+Lg.z*e,b=Math.hypot(_,v,y),x=G(b,lg*.55,ug)/Math.max(b,1e-4);_*=x,v*=x,y*=x,this.velocity[o]=_,this.velocity[o+1]=v,this.velocity[o+2]=y,this.position[o]=s+(_+t)*e,this.position[o+1]=Math.max(h+1.2,c+v*e),this.position[o+2]=l+(y+n)*e,this.recall(r,t,n),this.poseBird(r,_,v,y)}this.gulls.instanceMatrix.needsUpdate=!0,this.amplitude.needsUpdate=!0}recall(e,t,n){let r=e*3,i=(this.position[r]??0)-Vg.x,a=(this.position[r+2]??0)-Vg.z;if(i*i+a*a<sg*sg)return;let o=Math.hypot(t,n),s=o>.1?-t/o:1,c=o>.1?-n/o:0,l=this.rng.range(-.7,.7),u=this.rng.range(sg*.5,sg*.8);this.position[r]=Vg.x+(s*Math.cos(l)-c*Math.sin(l))*u,this.position[r+2]=Vg.z+(s*Math.sin(l)+c*Math.cos(l))*u,this.position[r+1]=Vg.y+this.rng.range(dg,fg)}poseBird(e,t,n,r){let i=e*3;jg.set(this.position[i]??0,this.position[i+1]??0,this.position[i+2]??0),Mg.set(t,n,r).normalize(),Ng.setFromUnitVectors(Hg,Mg);let a=G((Lg.x*-r+Lg.z*t)/90,-.9,.9);Pg.setFromAxisAngle(Ug,a),Ng.multiply(Pg),Ag.compose(jg,Ng,Ig),this.gulls.setMatrixAt(e,Ag),this.amplitude.setX(e,G(.16+n*.09,.02,.62))}waterAt(e,t){return this.sea===null?this.engine.world.tideHeight:this.sea.heightAt(e,t)}reseat(e,t){let n=e>=bg,r=e*kg,i=this.engine.camera.position,a=n?Cg:Sg,o=n?Tg:wg,s=this.rng.range(0,Math.PI*2),c=this.rng.range(a[0],a[1]);this.animals[r]=i.x+Math.cos(s)*c,this.animals[r+1]=i.z+Math.sin(s)*c,this.animals[r+2]=this.rng.range(0,Math.PI*2),this.animals[r+4]=this.rng.range(o[0],o[1]),this.animals[r+3]=t?this.rng.range(0,this.animals[r+4]??1):0,this.animals[r+5]=n?this.rng.range(.85,1.25):this.rng.range(.8,1.2)}updateCetaceans(e,t){let n=0,r=0,i=0;for(let t=0;t<8;t+=1){let a=t>=bg,o=t*kg,s=a?Dg:Eg,c=(this.animals[o+3]??0)+e;this.animals[o+3]=c;let l=this.animals[o+4]??60;if(c>l+s){this.reseat(t,!1);continue}if(c<l)continue;let u=(c-l)/s,d=this.animals[o+2]??0,f=a?2.4:9,p=(u-.5)*s*f,m=(this.animals[o]??0)+Math.sin(d)*p,h=(this.animals[o+1]??0)+Math.cos(d)*p,g=this.waterAt(m,h),_=this.animals[o+5]??1,v=a?.75:2.3,y=Math.sin(u*Math.PI)*v,b=Math.cos(u*Math.PI)*(a?.18:.85);jg.set(m,g+y-(a?1.5:.55)*_,h),Mg.set(Math.sin(d)*Math.cos(b),Math.sin(b),Math.cos(d)*Math.cos(b)),Ng.setFromUnitVectors(Hg,Mg.normalize());let x=_*(a?7.4:1.15);if(Fg.set(x,x,x),Ag.compose(jg,Ng,Fg),a){this.whales.setMatrixAt(r,Ag),r+=1;let e=c-l;if(e<Og){let t=G(e/.35,0,1)*G(1-e/Og,0,1);jg.y=g+y+.6,Ng.setFromAxisAngle(Ug,.18),Fg.set(1+t*1.4,1+t*2.6,1+t*1.4),Ag.compose(jg,Ng,Fg),this.spouts.setMatrixAt(i,Ag),i+=1}}else this.dolphins.setMatrixAt(n,Ag),n+=1}this.dolphins.count=n,this.whales.count=r,this.spouts.count=i,this.dolphins.visible=n>0,this.whales.visible=r>0,this.spouts.visible=i>0,this.dolphins.instanceMatrix.needsUpdate=!0,this.whales.instanceMatrix.needsUpdate=!0,this.spouts.instanceMatrix.needsUpdate=!0,this.spoutMaterial.opacity=G(.25+t.world.windSpeed*.02,.25,.7)}};function Gg(e,t,n){let r=e[t];r!==void 0&&(r.value=n)}function Kg(e,t,n,r,a){return new i({vertexShader:ig,fragmentShader:ag,uniforms:{...Oo(),uTime:{value:0},uUnderside:{value:e},uMantle:{value:t},uTip:{value:n},uTranslucency:{value:r},uRoughness:{value:a}},side:2})}var qg=144,Jg=24;function Yg(e){return t=>Sn(tn(t),e).horizontal.altitude*Yt}function Xg(e){return t=>{let n=Zn(tn(t),e),r=-(n.angularRadius*Yt+34/60);return n.horizontal.altitude*Yt-r}}function Zg(e,t){let n=t/15*36e5,r=e+n;return Math.floor(r/Jt)*Jt-n}function Qg(e,t,n){let r=Jt/qg,i=t,a=e(i)-n,o=null,s=null,c=a>0,l=a<=0;for(let u=1;u<=qg;u+=1){let d=t+u*r,f=e(d)-n;f>0?c=!0:l=!0,a<=0&&f>0&&o===null?o=$g(e,n,i,d):a>0&&f<=0&&s===null&&(s=$g(e,n,i,d)),i=d,a=f}return{rise:o,set:s,alwaysUp:c&&!l,alwaysDown:l&&!c}}function $g(e,t,n,r){let i=n,a=r,o=e(i)-t;for(let n=0;n<Jg;n+=1){let n=(i+a)/2,r=e(n)-t;if(r===0)return n;o<0==r<0?i=n:a=n}return(i+a)/2}function e_(e,t){let n=Zg(t,e.longitudeDeg),r=Yg(e),i=n,a=n+Jt,o=(Math.sqrt(5)-1)/2,s=a-o*(a-i),c=i+o*(a-i);for(let e=0;e<40;e+=1)r(s)>r(c)?a=c:i=s,s=a-o*(a-i),c=i+o*(a-i);return(i+a)/2}function t_(e,t){let n=Zg(t,e.longitudeDeg),r=Yg(e),i=Qg(r,n,Cn),a=Qg(r,n,-6),o=Qg(r,n,-12),s=Qg(r,n,-18),c=Qg(Xg(e),n,0);return{sunrise:i.rise,sunset:i.set,solarNoon:e_(e,t),civilDawn:a.rise,civilDusk:a.set,nauticalDawn:o.rise,nauticalDusk:o.set,astronomicalDawn:s.rise,astronomicalDusk:s.set,moonrise:c.rise,moonset:c.set}}var n_=Math.PI*2,r_=180/Math.PI,i_=1.943844,a_=10,o_=.82,s_=[`Sun`,`Mon`,`Tue`,`Wed`,`Thu`,`Fri`,`Sat`],c_=[`Jan`,`Feb`,`Mar`,`Apr`,`May`,`Jun`,`Jul`,`Aug`,`Sep`,`Oct`,`Nov`,`Dec`],l_=[`N`,`NNE`,`NE`,`ENE`,`E`,`ESE`,`SE`,`SSE`,`S`,`SSW`,`SW`,`WSW`,`W`,`WNW`,`NW`,`NNW`],Z=class{apply;last;constructor(e){this.apply=e}set(e){e!==this.last&&(this.last=e,this.apply(e))}};function u_(e){return e<0?0:e>1?1:e}function d_(e){let t=e%n_;return t<0?t+n_:t}function f_(e){return e<10?`0${e}`:String(e)}function p_(e,t){let n=new Date(e+t*6e4);return`${f_(n.getUTCHours())}:${f_(n.getUTCMinutes())}`}function m_(e,t){let n=new Date(e+t*6e4);return`${s_[n.getUTCDay()]??``} ${n.getUTCDate()} ${c_[n.getUTCMonth()]??``}`}function h_(e){let t=Math.round(e*10)/10;return`${t<0?`−`:`+`}${Math.abs(t).toFixed(1)}°`}function g_(e){return l_[Math.round(d_(e)/(n_/16))%16]??`N`}function __(e){let t=d_(e)*r_,n=t>180?360-t:t;return n<11.25?`ahead`:n>168.75?`astern`:`${t>180?`port`:`stbd`} ${n<67.5?`bow`:n<112.5?`beam`:`quarter`}`}function v_(e,t){let n=2*u_(e)-1,r=(Math.abs(n)*t).toFixed(3),i=+(n>=0);return`M ${-t} 0 A ${t} ${t} 0 0 1 ${t} 0 A ${t} ${r} 0 0 ${i} ${-t} 0 Z`}function y_(){let e=``;for(let t=0;t<32;t+=1){let n=t*n_/32,r=t%4==0,i=Math.sin(n),a=-Math.cos(n),o=44-(r?8:4);e+=`<line class="compass__tick${r?` compass__tick--major`:``}" x1="${(i*44).toFixed(2)}" y1="${(a*44).toFixed(2)}" x2="${(i*o).toFixed(2)}" y2="${(a*o).toFixed(2)}"/>`}let t=[`N`,`E`,`S`,`W`];for(let n=0;n<4;n+=1){let r=n*Math.PI/2;e+=`<text class="compass__cardinal" x="${(Math.sin(r)*27).toFixed(2)}" y="${(-Math.cos(r)*27).toFixed(2)}">${t[n]??``}</text>`}return e}function b_(){let e=``;for(let t=0;t<8;t+=1){let n=t*n_/8,r=Math.sin(n),i=Math.cos(n);e+=`<line class="sun-glyph__ray" x1="${(r*7.6).toFixed(2)}" y1="${(i*7.6).toFixed(2)}" x2="${(r*10).toFixed(2)}" y2="${(i*10).toFixed(2)}"/>`}return e}var x_=`
<div class="hud-panel hud__storm" role="status">
  <span class="hud__storm-title">Storm</span>
  <span class="hud-row__value" data-storm-detail></span>
</div>
<section class="hud-panel hud__nav" aria-label="Navigation">
  <svg class="compass" viewBox="-50 -50 100 100" aria-hidden="true">
    <circle class="compass__ring" cx="0" cy="0" r="44"/>
    <g data-rose>${y_()}</g>
    <path class="compass__lubber" d="M0 -47 l-3.4 -6.4 h6.8 z"/>
  </svg>
  <div class="hud__nav-readout">
    <div class="hud-figure"><span class="hud-figure__value" data-heading>000</span><span class="hud-figure__unit">&deg;</span></div>
    <div class="hud-label" data-heading-point>N</div>
    <div class="hud-rule"></div>
    <div class="hud-figure"><span class="hud-figure__value" data-speed>0.0</span><span class="hud-figure__unit">kn</span></div>
  </div>
</section>
<section class="hud-panel hud__sky" aria-label="Sky">
  <div class="hud__clock">
    <span class="hud__clock-time" data-clock>--:--</span>
    <span class="hud-label" data-date></span>
  </div>
  <div class="hud-rule"></div>
  <div class="hud__bodies">
    <div class="hud__body">
      <div class="hud__body-head">
        <svg class="sun-glyph" viewBox="-12 -12 24 24" aria-hidden="true">
          <circle class="sun-glyph__disc" cx="0" cy="0" r="5.2"/>${b_()}
        </svg>
        <span class="hud-label">Sun</span>
      </div>
      <div class="hud-row"><span class="hud-label">Alt</span><span class="hud-row__value" data-sun-alt>&mdash;</span></div>
      <div class="hud-row"><span class="hud-label">Rise</span><span class="hud-row__value" data-sunrise>&mdash;</span></div>
      <div class="hud-row"><span class="hud-label">Set</span><span class="hud-row__value" data-sunset>&mdash;</span></div>
    </div>
    <div class="hud__body">
      <div class="hud__body-head">
        <svg class="moon-glyph" viewBox="-12 -12 24 24" aria-hidden="true">
          <circle class="moon-glyph__dark" cx="0" cy="0" r="${a_}"/>
          <g data-moon-limb><path class="moon-glyph__lit" data-moon-path d=""/></g>
          <g data-moon-north><line class="moon-glyph__north" x1="0" y1="-10.6" x2="0" y2="-11.9"/></g>
        </svg>
        <span class="hud__phase" data-moon-phase>&mdash;</span>
      </div>
      <div class="hud-row"><span class="hud-label">Alt</span><span class="hud-row__value" data-moon-alt>&mdash;</span></div>
      <div class="hud-row"><span class="hud-label">Rise</span><span class="hud-row__value" data-moonrise>&mdash;</span></div>
      <div class="hud-row"><span class="hud-label">Set</span><span class="hud-row__value" data-moonset>&mdash;</span></div>
    </div>
  </div>
</section>
<section class="hud-panel hud__weather" aria-label="Weather">
  <div class="hud__baro">
    <span class="hud-figure__value" data-pressure>1013</span>
    <span class="hud-figure__unit">hPa</span>
    <svg class="hud__trend" data-trend viewBox="-4.5 -6.5 9 13" aria-hidden="true">
      <path class="hud__trend-mark" data-trend-mark d=""/>
    </svg>
  </div>
  <div class="hud-row"><span class="hud-label">Trend</span><span class="hud-row__value" data-trend-value>&mdash;</span></div>
  <div class="hud-rule"></div>
  <div class="hud__wind">
    <svg class="wind-dial" data-wind-dial viewBox="-20 -20 40 40" aria-hidden="true">
      <circle class="wind-dial__ring" cx="0" cy="0" r="13"/>
      <path class="wind-dial__hull" d="M0 -10 C4 -5.5 4.6 1.5 3 8.5 L-3 8.5 C-4.6 1.5 -4 -5.5 0 -10 Z"/>
      <g data-wind-arrow><path class="wind-dial__arrow" d="M0 -19.4 L4.2 -13.4 L-4.2 -13.4 Z"/></g>
    </svg>
    <div>
      <div class="hud-figure"><span class="hud-figure__value" data-wind-speed>0</span><span class="hud-figure__unit">kn</span></div>
      <div class="hud-row"><span class="hud-label">Force</span><span class="hud-row__value" data-beaufort>0</span></div>
      <div class="hud-row"><span class="hud-label">From</span><span class="hud-row__value" data-wind-from>&mdash;</span></div>
    </div>
  </div>
</section>
<div class="hud__tension" data-tension aria-label="Line tension">
  <div class="tension__track">
    <div class="tension__fill" data-tension-fill></div>
    <div class="tension__limit"></div>
  </div>
  <div class="tension__legend">
    <span class="hud-label">Line</span><span class="hud-row__value" data-tension-value>0%</span>
  </div>
</div>`,S_=`M0 5 V-5 M-3 -2 L0 -5 L3 -2`,C_=`M0 -5 V5 M-3 2 L0 5 L3 2`,w_=`M-4 0 H4`,T_=class{root;fields;constructor(e){let t=document.createElement(`div`);t.className=`hud`,t.innerHTML=x_,e.appendChild(t),this.root=t;let n=e=>{let n=t.querySelector(e);if(n===null)throw Error(`HUD markup is missing ${e}`);return n},r=e=>{let t=n(e);return e=>{t.textContent=e}},i=(e,t)=>{let r=n(e);return e=>r.setAttribute(t,e)},a=(e,t)=>{let r=n(e);return e=>r.classList.toggle(t,e)},o=(e,t)=>{let n=r(e);return new Z(e=>n(t(e)))},s=e=>o(e,e=>e<0?`—`:p_(e,0)),c=i(`[data-moon-path]`,`d`),l=i(`[data-moon-limb]`,`transform`),u=i(`[data-moon-north]`,`transform`),d=i(`[data-wind-arrow]`,`transform`),f=n(`[data-tension-fill]`),p=r(`[data-tension-value]`);this.fields={rose:new Z(i(`[data-rose]`,`transform`)),heading:o(`[data-heading]`,e=>String(e).padStart(3,`0`)),headingPoint:new Z(r(`[data-heading-point]`)),speed:o(`[data-speed]`,e=>(e/10).toFixed(1)),clock:o(`[data-clock]`,e=>p_(e*6e4,0)),date:o(`[data-date]`,e=>m_(e*864e5,0)),sunAltitude:o(`[data-sun-alt]`,e=>h_(e/10)),sunrise:s(`[data-sunrise]`),sunset:s(`[data-sunset]`),moonAltitude:o(`[data-moon-alt]`,e=>h_(e/10)),moonrise:s(`[data-moonrise]`),moonset:s(`[data-moonset]`),moonPath:new Z(e=>c(v_(e/1e3,a_))),moonLimb:new Z(e=>l(`rotate(${e/2})`)),moonNorth:new Z(e=>u(`rotate(${e/2})`)),moonPhase:new Z(r(`[data-moon-phase]`)),pressure:o(`[data-pressure]`,e=>String(e)),trendArrow:new Z(i(`[data-trend-mark]`,`d`)),trendFalling:new Z(a(`[data-trend]`,`is-falling`)),trendValue:o(`[data-trend-value]`,e=>{let t=e/10;return`${t<0?`−`:`+`}${Math.abs(t).toFixed(1)} hPa/h`}),windSpeed:o(`[data-wind-speed]`,e=>String(e)),windStrong:new Z(a(`[data-wind-dial]`,`is-strong`)),beaufort:o(`[data-beaufort]`,e=>String(e)),windArrow:new Z(e=>d(`rotate(${e})`)),windFrom:new Z(r(`[data-wind-from]`)),tensionLive:new Z(a(`[data-tension]`,`is-live`)),tensionFill:new Z(e=>{f instanceof HTMLElement&&(f.style.width=`${e/10}%`),p(`${Math.round(e/10)}%`)}),tensionStrained:new Z(a(`[data-tension]`,`is-strained`)),tensionParting:new Z(a(`[data-tension]`,`is-parting`)),stormLive:new Z(a(`.hud__storm`,`is-live`)),stormDetail:o(`[data-storm-detail]`,e=>e<=0?`overhead`:`${e} min`)}}update(e){let t=this.fields,n=e.utcOffsetMinutes*6e4,r=e=>e===null?-1:e+n,i=d_(e.headingRad)*r_;t.rose.set(`rotate(${(-i).toFixed(1)})`),t.heading.set(Math.round(i)%360),t.headingPoint.set(g_(e.headingRad)),t.speed.set(Math.round(Math.max(0,e.speedKnots)*10));let a=e.epochMs+n;t.clock.set(Math.floor(a/6e4)),t.date.set(Math.floor(a/864e5)),t.sunAltitude.set(Math.round(e.sunAltitudeDeg*10)),t.sunrise.set(r(e.sunriseMs)),t.sunset.set(r(e.sunsetMs)),t.moonAltitude.set(Math.round(e.moonAltitudeDeg*10)),t.moonrise.set(r(e.moonriseMs)),t.moonset.set(r(e.moonsetMs)),t.moonPath.set(Math.round(u_(e.moonIlluminatedFraction)*1e3)),t.moonLimb.set(Math.round(d_(e.moonBrightLimbAngle)*r_*2)),t.moonNorth.set(Math.round(d_(e.moonNorthAngle)*r_*2)),t.moonPhase.set(e.moonPhase.replace(/-/g,` `)),t.pressure.set(Math.round(e.pressureHpa));let o=e.pressureTrendHpaPerHour;t.trendValue.set(Math.round(o*10)),t.trendArrow.set(o>.5?S_:o<-.5?C_:w_),t.trendFalling.set(o<-.5);let s=e.windSpeed*i_;t.windSpeed.set(Math.round(s)),t.beaufort.set(Math.round(e.beaufort)),t.windStrong.set(e.beaufort>=7);let c=e.windDirectionRad-e.headingRad;t.windArrow.set(Math.round(d_(c)*r_)),t.windFrom.set(`${g_(e.windDirectionRad+Math.PI)} · ${__(c+Math.PI)}`);let l=u_(e.lineTension);t.tensionLive.set(e.hooked),e.hooked&&(t.tensionFill.set(Math.round(l*1e3)),t.tensionStrained.set(l>=.6&&l<o_),t.tensionParting.set(l>=o_)),t.stormLive.set(e.stormApproaching),e.stormApproaching&&t.stormDetail.set(Math.round(e.stormMinutesAway))}dispose(){this.root.remove()}},E_=6500,D_=`
<h3 class="catch-card__name" data-name></h3>
<p class="catch-card__latin" data-latin></p>
<div class="hud-rule"></div>
<div class="hud-row"><span class="hud-label">Weight</span><span class="hud-row__value" data-mass></span></div>
<div class="hud-row"><span class="hud-label">Length</span><span class="hud-row__value" data-length></span></div>
<div class="hud-row"><span class="hud-label">Earned</span><span class="catch-card__earned" data-value></span></div>
<div class="catch-card__flags" data-flags></div>
<div class="catch-card__hint">Click to dismiss</div>`;function O_(e){return e<1?`${Math.round(e*1e3)} g`:e<10?`${e.toFixed(2)} kg`:`${e.toFixed(1)} kg`}function k_(e){return e<1?`${Math.round(e*100)} cm`:`${e.toFixed(2)} m`}function A_(e){return Math.round(e).toString().replace(/\B(?=(\d{3})+(?!\d))/g,` `)}var j_=class{root;name;latin;mass;length;value;flags;rarity=`common`;dwellTimer=0;onClick=()=>{this.dismiss()};onKeyDown=e=>{e.key===`Escape`&&this.isVisible&&this.dismiss()};constructor(e){let t=document.createElement(`aside`);t.className=`hud-panel catch-card`,t.setAttribute(`role`,`status`),t.innerHTML=D_,e.appendChild(t),this.root=t;let n=e=>{let n=t.querySelector(e);if(!(n instanceof HTMLElement))throw Error(`Catch card is missing ${e}`);return n};this.name=n(`[data-name]`),this.latin=n(`[data-latin]`),this.mass=n(`[data-mass]`),this.length=n(`[data-length]`),this.value=n(`[data-value]`),this.flags=n(`[data-flags]`),t.addEventListener(`click`,this.onClick),window.addEventListener(`keydown`,this.onKeyDown)}show(e){window.clearTimeout(this.dwellTimer),this.name.textContent=e.species,this.latin.textContent=e.latin,this.mass.textContent=O_(e.massKg),this.length.textContent=k_(e.lengthM),this.value.textContent=`+${A_(e.value)}`,this.root.classList.remove(`catch-card--${this.rarity}`),this.rarity=e.rarity,this.root.classList.add(`catch-card--${this.rarity}`),this.flags.replaceChildren(),this.addFlag(e.rarity,!1),e.firstCatch&&this.addFlag(`first catch`,!0),e.personalBest&&this.addFlag(`personal best`,!0),e.albino&&this.addFlag(`albino`,!0),this.root.classList.remove(`is-live`),this.root.offsetWidth,this.root.classList.add(`is-live`),this.dwellTimer=window.setTimeout(()=>this.dismiss(),E_)}dismiss(){window.clearTimeout(this.dwellTimer),this.root.classList.remove(`is-live`)}get isVisible(){return this.root.classList.contains(`is-live`)}dispose(){window.clearTimeout(this.dwellTimer),this.root.removeEventListener(`click`,this.onClick),window.removeEventListener(`keydown`,this.onKeyDown),this.root.remove()}addFlag(e,t){let n=document.createElement(`span`);n.className=t?`catch-card__flag catch-card__flag--best`:`catch-card__flag`,n.textContent=e,this.flags.appendChild(n)}},M_=`
<div class="overlay__sheet journal__sheet">
  <header class="overlay__head">
    <h2 class="overlay__title">Journal</h2>
    <span class="hud-row__value" data-tally></span>
    <span class="hud-row__value" data-purse></span>
    <button type="button" class="overlay__close" data-close>Close</button>
  </header>
  <div class="overlay__body"><div class="journal__grid" data-grid></div></div>
</div>`;function N_(e,t){let n=Math.min(17.5,4+Math.max(0,e)*26),r=n*.26,i=t?`L95 ${(20-n*.72).toFixed(2)} L83 20 L95 ${(20+n*.72).toFixed(2)} `:`L93 ${(20-n*.4).toFixed(2)} L93 ${(20+n*.4).toFixed(2)} `;return`M5 20 C20 ${(20-n).toFixed(2)} 50 ${(20-n).toFixed(2)} 74 ${(20-r).toFixed(2)} `+i+`L74 ${(20+r).toFixed(2)} C50 ${(20+n).toFixed(2)} 20 ${(20+n).toFixed(2)} 5 20 Z`}function P_(e){return e<=0?`not recorded`:new Date(e).toISOString().slice(0,10)}var F_=class{root;grid;tally;purse;species=[];records=new Map;onKeyDown=e=>{e.key===`Escape`&&this.isOpen&&this.close()};onPointerDown=e=>{e.target===this.root&&this.close()};constructor(e){let t=document.createElement(`div`);t.className=`overlay journal`,t.setAttribute(`role`,`dialog`),t.setAttribute(`aria-label`,`Species journal`),t.innerHTML=M_,e.appendChild(t),this.root=t;let n=t.querySelector(`[data-grid]`),r=t.querySelector(`[data-tally]`),i=t.querySelector(`[data-purse]`),a=t.querySelector(`[data-close]`);if(!(n instanceof HTMLElement)||!(r instanceof HTMLElement)||!(i instanceof HTMLElement)||a===null)throw Error(`Journal markup is incomplete`);this.grid=n,this.tally=r,this.purse=i,a.addEventListener(`click`,()=>this.close()),t.addEventListener(`pointerdown`,this.onPointerDown),window.addEventListener(`keydown`,this.onKeyDown)}setSpecies(e){this.species=e,this.render()}setRecords(e){this.records=new Map(e.map(e=>[e.speciesId,e])),this.render()}setSummary(e,t){this.purse.textContent=t===0?``:`${t} landed · ${A_(e)} earned`}get isOpen(){return this.root.classList.contains(`is-open`)}open(){this.root.classList.add(`is-open`)}close(){this.root.classList.remove(`is-open`)}toggle(){this.root.classList.toggle(`is-open`)}dispose(){this.root.removeEventListener(`pointerdown`,this.onPointerDown),window.removeEventListener(`keydown`,this.onKeyDown),this.root.remove()}render(){let e=document.createDocumentFragment(),t=0;for(let n of this.species){let r=this.records.get(n.id);r!==void 0&&(t+=1),e.appendChild(this.renderEntry(n,r))}this.grid.replaceChildren(e),this.tally.textContent=this.species.length===0?``:`${t} / ${this.species.length} species`}renderEntry(e,t){let n=document.createElement(`article`);n.className=t===void 0?`journal__entry journal__entry--uncaught`:`journal__entry`;let r=t!==void 0;n.innerHTML=`<svg class="journal__silhouette" viewBox="0 0 100 40" aria-hidden="true"><path class="journal__shape" d="${N_(e.bodyDepth,e.forkedTail)}"/></svg>`;let i=document.createElement(`div`);i.className=`journal__name`,i.textContent=r?e.name:`Unrecorded`;let a=document.createElement(`div`);if(a.className=`journal__latin`,a.textContent=r?e.latin:e.rarity,n.append(i,a),t===void 0){let e=document.createElement(`div`);return e.className=`hud-label`,e.textContent=`never landed`,n.appendChild(e),n}let o=document.createElement(`div`);o.className=`journal__summary`,o.append(I_(`×${t.count}`),I_(O_(t.bestMassKg)),I_(k_(t.bestLengthM)));let s=document.createElement(`div`);return s.className=`hud-label`,s.textContent=`first ${P_(t.firstCaughtMs)}`,n.append(o,s),n}};function I_(e){let t=document.createElement(`span`);return t.textContent=e,t}var L_=[{key:`renderScale`,label:`Render scale`,min:.5,max:1.5,step:.05,decimals:2},{key:`waveCount`,label:`Gerstner waves`,min:4,max:8,step:1,decimals:0},{key:`oceanGridResolution`,label:`Ocean grid`,min:64,max:256,step:16,decimals:0},{key:`oceanRings`,label:`Clipmap rings`,min:3,max:9,step:1,decimals:0},{key:`cloudSteps`,label:`Cloud steps`,min:8,max:96,step:2,decimals:0},{key:`cloudScale`,label:`Cloud buffer`,min:.25,max:1,step:.05,decimals:2},{key:`refractionScale`,label:`Refraction buffer`,min:.25,max:1,step:.05,decimals:2},{key:`shadowCascades`,label:`Shadow cascades`,min:1,max:4,step:1,decimals:0},{key:`shadowMapSize`,label:`Shadow map`,min:512,max:4096,step:512,decimals:0},{key:`drawDistance`,label:`Draw distance (m)`,min:1200,max:9e3,step:100,decimals:0},{key:`instanceDensity`,label:`Instance density`,min:.1,max:1,step:.05,decimals:2},{key:`schoolSize`,label:`School size`,min:8,max:128,step:4,decimals:0},{key:`probeFacesPerFrame`,label:`Probe faces / frame`,min:1,max:6,step:1,decimals:0},{key:`probeResolution`,label:`Probe resolution`,min:32,max:512,step:32,decimals:0},{key:`anisotropy`,label:`Anisotropy`,min:1,max:16,step:1,decimals:0}],R_=[{key:`shadowsEnabled`,label:`Shadows`},{key:`ssaoEnabled`,label:`Ambient occlusion`},{key:`bloomEnabled`,label:`Bloom`},{key:`gradeEnabled`,label:`Colour grade`},{key:`dofEnabled`,label:`Depth of field`},{key:`godRaysEnabled`,label:`God rays`},{key:`motionBlurEnabled`,label:`Motion blur`},{key:`chromaticAberrationEnabled`,label:`Chromatic aberration`},{key:`grainEnabled`,label:`Film grain`},{key:`vignetteEnabled`,label:`Vignette`}],z_=[`low`,`medium`,`high`,`ultra`],B_=[1,60,600,3600],V_=[{name:`Tel Aviv`,latitudeDeg:32.08,longitudeDeg:34.78},{name:`Reykjavik`,latitudeDeg:64.15,longitudeDeg:-21.94},{name:`Bergen`,latitudeDeg:60.39,longitudeDeg:5.32},{name:`Aberdeen`,latitudeDeg:57.15,longitudeDeg:-2.09},{name:`Newfoundland`,latitudeDeg:47.56,longitudeDeg:-52.71},{name:`Cape Town`,latitudeDeg:-33.92,longitudeDeg:18.42},{name:`Hobart`,latitudeDeg:-42.88,longitudeDeg:147.33}];function H_(e){return String(e).padStart(2,`0`)}function U_(e){let t=new Date(e);return`${t.getFullYear()}-${H_(t.getMonth()+1)}-${H_(t.getDate())}T${H_(t.getHours())}:${H_(t.getMinutes())}`}var W_=class{settings;root;body;syncs=[];unsubscribe;applying=!1;onKeyDown=e=>{e.key===`Escape`&&this.isOpen&&this.close()};onPointerDown=e=>{e.target===this.root&&this.close()};constructor(e,t){this.settings=t;let n=document.createElement(`div`);n.className=`overlay settings`,n.setAttribute(`role`,`dialog`),n.setAttribute(`aria-label`,`Settings`),n.innerHTML=`
<div class="overlay__sheet settings__sheet">
  <header class="overlay__head">
    <h2 class="overlay__title">Settings</h2>
    <button type="button" class="overlay__close" data-close>Close</button>
  </header>
  <div class="overlay__body" data-body></div>
</div>`,e.appendChild(n),this.root=n;let r=n.querySelector(`[data-body]`),i=n.querySelector(`[data-close]`);if(!(r instanceof HTMLElement)||i===null)throw Error(`Settings markup is incomplete`);this.body=r,i.addEventListener(`click`,()=>this.close()),n.addEventListener(`pointerdown`,this.onPointerDown),window.addEventListener(`keydown`,this.onKeyDown),this.buildGraphics(),this.buildAudio(),this.buildWorld(),this.refresh(),this.unsubscribe=t.onChange(()=>{this.applying||this.refresh()})}get isOpen(){return this.root.classList.contains(`is-open`)}open(){this.root.classList.add(`is-open`),this.refresh()}close(){this.root.classList.remove(`is-open`)}toggle(){this.isOpen?this.close():this.open()}refresh(){for(let e of this.syncs)e()}dispose(){this.unsubscribe(),this.root.removeEventListener(`pointerdown`,this.onPointerDown),window.removeEventListener(`keydown`,this.onKeyDown),this.root.remove()}buildGraphics(){let e=this.group(`Graphics`);this.choices(e,z_.map(e=>({id:e,label:e})),()=>this.settings.graphics.preset,e=>{let t=z_.find(t=>t===e);t!==void 0&&this.settings.applyPreset(t)});for(let t of L_)this.slider(e,t.label,t,()=>this.settings.graphics[t.key],e=>{this.settings.graphics[t.key]=e,this.settings.emit(`graphics`)});this.dropdown(e,`Antialiasing`,[{id:`none`,label:`Off`},{id:`smaa`,label:`SMAA`}],()=>this.settings.graphics.antialias,e=>{this.settings.graphics.antialias=e===`smaa`?`smaa`:`none`,this.settings.emit(`graphics`)});for(let t of R_)this.switchRow(e,t.label,()=>this.settings.graphics[t.key],e=>{this.settings.graphics[t.key]=e,this.settings.emit(`graphics`)})}buildAudio(){let e=this.group(`Audio`),t={min:0,max:1,step:.01,decimals:2};this.slider(e,`Master volume`,t,()=>this.settings.audio.masterVolume,e=>{this.settings.audio.masterVolume=e,this.settings.emit(`audio`)}),this.slider(e,`Music volume`,t,()=>this.settings.audio.musicVolume,e=>{this.settings.audio.musicVolume=e,this.settings.emit(`audio`)}),this.switchRow(e,`Mute`,()=>this.settings.audio.muted,e=>{this.settings.audio.muted=e,this.settings.emit(`audio`)})}buildWorld(){let e=this.group(`Time`);this.choices(e,B_.map(e=>({id:String(e),label:`${e}×`})),()=>String(this.settings.world.timeScale),e=>{let t=Number(e);Number.isFinite(t)&&(this.settings.world.timeScale=t,this.settings.emit(`world`))}),this.note(e,`Above 1× the sun and moon move at that multiple of real time.`);let t=this.field(e,`Date and time`),n=document.createElement(`input`);n.type=`datetime-local`,t.appendChild(n),n.addEventListener(`change`,()=>{let e=Date.parse(n.value);Number.isNaN(e)||this.write(()=>{this.settings.world.timeOverrideMs=e,this.settings.emit(`world`)})}),this.syncs.push(()=>{let e=this.settings.world.timeOverrideMs;n.value=U_(e??Date.now())}),this.choices(e,[{id:`live`,label:`Back to real time`}],()=>this.settings.world.timeOverrideMs===null?`live`:``,()=>{this.settings.world.timeOverrideMs=null,this.settings.emit(`world`)});let r=this.group(`Location`);this.choices(r,V_.map(e=>({id:e.name,label:e.name})),()=>this.nearestPreset(),e=>{let t=V_.find(t=>t.name===e);t!==void 0&&this.settings.setLocation(t.latitudeDeg,t.longitudeDeg)}),this.coordinate(r,`Latitude`,-90,90,()=>this.settings.world.latitudeDeg),this.coordinate(r,`Longitude`,-180,180,()=>this.settings.world.longitudeDeg),this.note(r,`Changing position recomputes the ephemeris; the sky follows immediately.`)}group(e){let t=document.createElement(`section`);t.className=`settings__group`;let n=document.createElement(`div`);return n.className=`settings__group-title`,n.textContent=e,t.appendChild(n),this.body.appendChild(t),t}field(e,t){let n=document.createElement(`label`);n.className=`settings__field`;let r=document.createElement(`span`);return r.textContent=t,n.appendChild(r),e.appendChild(n),n}note(e,t){let n=document.createElement(`p`);n.className=`settings__note`,n.textContent=t,e.appendChild(n)}slider(e,t,n,r,i){let a=this.field(e,t),o=document.createElement(`span`);o.className=`settings__field-value`;let s=document.createElement(`input`);s.type=`range`,s.min=String(n.min),s.max=String(n.max),s.step=String(n.step),a.append(o,s),s.addEventListener(`input`,()=>{let e=Number(s.value);Number.isFinite(e)&&(o.textContent=e.toFixed(n.decimals),this.write(()=>i(e)))}),this.syncs.push(()=>{let e=r();s.value=String(e),o.textContent=e.toFixed(n.decimals)})}switchRow(e,t,n,r){let i=this.field(e,t),a=document.createElement(`input`);a.type=`checkbox`,i.appendChild(a),a.addEventListener(`change`,()=>this.write(()=>r(a.checked))),this.syncs.push(()=>{a.checked=n()})}dropdown(e,t,n,r,i){let a=this.field(e,t),o=document.createElement(`select`);for(let e of n){let t=document.createElement(`option`);t.value=e.id,t.textContent=e.label,o.appendChild(t)}a.appendChild(o),o.addEventListener(`change`,()=>this.write(()=>i(o.value))),this.syncs.push(()=>{o.value=r()})}choices(e,t,n,r){let i=document.createElement(`div`);i.className=`settings__choices`;let a=[];for(let e of t){let t=document.createElement(`button`);t.type=`button`,t.className=`settings__choice`,t.textContent=e.label,t.addEventListener(`click`,()=>this.write(()=>r(e.id))),i.appendChild(t),a.push(t)}e.appendChild(i),this.syncs.push(()=>{let e=n();for(let n=0;n<a.length;n+=1)a[n]?.classList.toggle(`is-active`,t[n]?.id===e)})}coordinate(e,t,n,r,i){let a=this.field(e,`${t} (°)`),o=document.createElement(`input`);o.type=`number`,o.min=String(n),o.max=String(r),o.step=`0.01`,a.appendChild(o),o.addEventListener(`change`,()=>{let e=Number(o.value);if(!Number.isFinite(e)||e<n||e>r){o.value=i().toFixed(2);return}let a=t===`Latitude`?e:this.settings.world.latitudeDeg,s=t===`Longitude`?e:this.settings.world.longitudeDeg;this.write(()=>this.settings.setLocation(a,s))}),this.syncs.push(()=>{o.value=i().toFixed(2)})}nearestPreset(){let{latitudeDeg:e,longitudeDeg:t}=this.settings.world;for(let n of V_)if(Math.abs(n.latitudeDeg-e)<.25&&Math.abs(n.longitudeDeg-t)<.25)return n.name;return``}write(e){this.applying=!0;try{e()}finally{this.applying=!1}this.refresh()}};function G_(){return{money:0,totalCatches:0,recent:[]}}function K_(){return{entries:[]}}var q_=class{moneyBalance=0;catches=0;log=[];entries=new Map;get money(){return this.moneyBalance}get totalCatches(){return this.catches}get recent(){return this.log}get journal(){return[...this.entries.values()]}entryFor(e){return this.entries.get(e)}hasCaught(e){return this.entries.has(e)}earn(e){!Number.isFinite(e)||e<=0||(this.moneyBalance+=Math.round(e))}spend(e){let t=Math.round(e);return!Number.isFinite(t)||t<0||t>this.moneyBalance?!1:(this.moneyBalance-=t,!0)}record(e,t,n=1){let r=Math.max(1,Math.round(e.value*n)),i={speciesId:e.species.id,massKg:e.massKg,lengthM:e.lengthM,albino:e.albino,value:r,caughtAtMs:t};this.log.unshift(i),this.log.length>64&&(this.log.length=64),this.catches+=1,this.moneyBalance+=r;let a=this.entries.get(i.speciesId);if(a===void 0)return this.entries.set(i.speciesId,{speciesId:i.speciesId,count:1,bestMassKg:i.massKg,bestLengthM:i.lengthM,firstCaughtMs:t,lastCaughtMs:t}),{record:i,personalBest:!0,firstCatch:!0,moneyEarned:r};a.count+=1,a.lastCaughtMs=t;let o=i.massKg>a.bestMassKg;return o&&(a.bestMassKg=i.massKg),i.lengthM>a.bestLengthM&&(a.bestLengthM=i.lengthM),{record:i,personalBest:o,firstCatch:!1,moneyEarned:r}}toInventoryData(){return{money:this.moneyBalance,totalCatches:this.catches,recent:this.log.map(e=>({...e}))}}toJournalData(){return{entries:this.journal.map(e=>({...e}))}}load(e,t){this.moneyBalance=e.money,this.catches=e.totalCatches,this.log.length=0;for(let t of e.recent.slice(0,64))this.log.push({...t});this.entries.clear();for(let e of t.entries)this.entries.set(e.speciesId,{...e})}clear(){this.moneyBalance=0,this.catches=0,this.log.length=0,this.entries.clear()}},J_=[`line-strength`,`reel-speed`,`lure-quality`,`sonar-range`,`engine-power`],Y_={"line-strength":{id:`line-strength`,name:`Line strength`,description:`Breaking strain. A heavier line survives a run that would part a light one.`,maxLevel:8,baseCost:140,costGrowth:1.62,base:55,perLevel:24,unit:`N`,decimals:0},"reel-speed":{id:`reel-speed`,name:`Reel speed`,description:`Line recovered per second at full crank. Shortens every fight.`,maxLevel:6,baseCost:180,costGrowth:1.74,base:.65,perLevel:.18,unit:`m/s`,decimals:2},"lure-quality":{id:`lure-quality`,name:`Lure quality`,description:`Multiplier on how convincing the bait is. Raises the bite rate directly.`,maxLevel:6,baseCost:110,costGrowth:1.85,base:1,perLevel:.11,unit:`×`,decimals:2},"sonar-range":{id:`sonar-range`,name:`Sonar range`,description:`Radius within which schools and structure are marked on the sounder.`,maxLevel:7,baseCost:220,costGrowth:1.68,base:40,perLevel:34,unit:`m`,decimals:0},"engine-power":{id:`engine-power`,name:`Engine power`,description:`Thrust at the propeller. Gets you to the mark, and off it in a blow.`,maxLevel:6,baseCost:260,costGrowth:1.8,base:2200,perLevel:900,unit:`N`,decimals:0}};function X_(e,t){let n=Y_[e],r=Math.max(0,Math.floor(t));return Math.round(n.baseCost*n.costGrowth**r)}function Z_(e,t){let n=Y_[e],r=Math.min(n.maxLevel,Math.max(0,Math.floor(t)));return n.base+n.perLevel*r}function Q_(){return{lineStrengthN:0,reelSpeedMps:0,lureQuality:1,sonarRangeM:0,enginePowerN:0}}var $_=class{levels={"line-strength":0,"reel-speed":0,"lure-quality":0,"sonar-range":0,"engine-power":0};cachedEffects=Q_();constructor(e){e===void 0?this.recomputeEffects():this.load(e)}levelOf(e){return this.levels[e]}maxLevelOf(e){return Y_[e].maxLevel}isMaxed(e){return this.levels[e]>=Y_[e].maxLevel}costOf(e){return this.isMaxed(e)?null:X_(e,this.levels[e])}canAfford(e,t){let n=this.costOf(e);return n!==null&&t>=n}effectOf(e){return Z_(e,this.levels[e])}purchase(e,t){let n=this.costOf(e);return n===null?{ok:!1,id:e,reason:`maxed`}:t.spend(n)?(this.levels[e]+=1,this.recomputeEffects(),{ok:!0,id:e,cost:n,level:this.levels[e]}):{ok:!1,id:e,reason:`insufficient-funds`}}setLevel(e,t){let n=Math.min(Y_[e].maxLevel,Math.max(0,Math.floor(t)));n!==this.levels[e]&&(this.levels[e]=n,this.recomputeEffects())}get effects(){return this.cachedEffects}toData(){let e={};for(let t of J_)e[t]=this.levels[t];return{levels:e}}load(e){for(let t of J_){let n=e.levels[t];this.levels[t]=Math.min(Y_[t].maxLevel,Math.max(0,typeof n==`number`&&Number.isFinite(n)?Math.floor(n):0))}this.recomputeEffects()}recomputeEffects(){this.cachedEffects.lineStrengthN=Z_(`line-strength`,this.levels[`line-strength`]),this.cachedEffects.reelSpeedMps=Z_(`reel-speed`,this.levels[`reel-speed`]),this.cachedEffects.lureQuality=Z_(`lure-quality`,this.levels[`lure-quality`]),this.cachedEffects.sonarRangeM=Z_(`sonar-range`,this.levels[`sonar-range`]),this.cachedEffects.enginePowerN=Z_(`engine-power`,this.levels[`engine-power`])}};function ev(){let e={};for(let t of J_)e[t]=0;return{levels:e}}var tv=`endless-fishing/save`,nv=[`low`,`medium`,`high`,`ultra`],rv=[1,60,600,3600],iv={line:`line-strength`,reel:`reel-speed`,lure:`lure-quality`,sonar:`sonar-range`,engine:`engine-power`};function av(){return{preset:`high`,masterVolume:.8,musicVolume:.35,muted:!1,timeScale:1,latitudeDeg:32.08,longitudeDeg:34.78}}function ov(){return{version:2,savedAtMs:0,progression:ev(),inventory:G_(),journal:K_(),settings:av()}}function sv(e){return typeof e!=`object`||!e||Array.isArray(e)?null:e}function cv(e){return Array.isArray(e)?e:[]}function Q(e,t,n,r){return typeof e!=`number`||!Number.isFinite(e)?t:Math.min(r,Math.max(n,e))}function lv(e,t,n,r){return Math.round(Q(e,t,n,r))}function uv(e,t){return typeof e==`boolean`?e:t}function dv(e){return typeof e==`string`&&e.length>0?e:null}function fv(e,t){let n=sv(e),r=ev().levels;if(n===null)return{levels:r};for(let[e,i]of Object.entries(n)){let n=t===null?e:t[e]??e,a=J_.find(e=>e===n);a!==void 0&&(r[a]=lv(i,0,0,Y_[a].maxLevel))}return{levels:r}}function pv(e){let t=sv(e);if(t===null)return null;let n=dv(t.speciesId);return n===null?null:{speciesId:n,massKg:Q(t.massKg,0,0,1e6),lengthM:Q(t.lengthM,0,0,1e4),albino:uv(t.albino,!1),value:Q(t.value,0,0,0xe8d4a51000),caughtAtMs:Q(t.caughtAtMs,0,0,2**53-1)}}function mv(e){let t=sv(e);if(t===null)return null;let n=dv(t.speciesId);if(n===null)return null;let r=Q(t.firstCaughtMs,0,0,2**53-1);return{speciesId:n,count:lv(t.count,1,0,2**53-1),bestMassKg:Q(t.bestMassKg,0,0,1e6),bestLengthM:Q(t.bestLengthM,0,0,1e4),firstCaughtMs:r,lastCaughtMs:Math.max(r,Q(t.lastCaughtMs,r,0,2**53-1))}}function hv(e){let t=av(),n=sv(e);if(n===null)return t;let r=dv(n.preset),i=Q(n.timeScale,t.timeScale,1,3600);return{preset:nv.find(e=>e===r)??t.preset,masterVolume:Q(n.masterVolume,t.masterVolume,0,1),musicVolume:Q(n.musicVolume,t.musicVolume,0,1),muted:uv(n.muted,t.muted),timeScale:rv.includes(i)?i:t.timeScale,latitudeDeg:Q(n.latitudeDeg,t.latitudeDeg,-90,90),longitudeDeg:Q(n.longitudeDeg,t.longitudeDeg,-180,180)}}function gv(e){let t=sv(e.inventory),n=sv(e.journal),r=[];for(let e of cv(t?.recent)){let t=pv(e);if(t!==null&&r.push(t),r.length>=64)break}let i=[],a=new Set;for(let e of cv(n?.entries)){let t=mv(e);t===null||a.has(t.speciesId)||(a.add(t.speciesId),i.push(t))}return{version:2,savedAtMs:Q(e.savedAtMs,0,0,2**53-1),progression:fv(sv(e.progression)?.levels,null),inventory:{money:lv(t?.money,0,0,2**53-1),totalCatches:lv(t?.totalCatches,0,0,2**53-1),recent:r},journal:{entries:i},settings:hv(e.settings)}}function _v(e){let t=ov();t.progression=fv(e.upgrades,iv),t.inventory.money=lv(e.money,0,0,2**53-1);let n=sv(e.bestMassKg)??{},r=new Set;for(let i of cv(e.caught)){let e=dv(i);e===null||r.has(e)||(r.add(e),t.journal.entries.push({speciesId:e,count:1,bestMassKg:Q(n[e],0,0,1e6),bestLengthM:0,firstCaughtMs:0,lastCaughtMs:0}))}t.inventory.totalCatches=t.journal.entries.length;let i=dv(e.preset);return i!==null&&(t.settings.preset=nv.find(e=>e===i)??t.settings.preset),t.settings.masterVolume=Q(e.volume,t.settings.masterVolume,0,1),t}function vv(e){let t=sv(e);if(t===null)return{data:ov(),status:`corrupt`,foundVersion:null};let n=t.version;return typeof n!=`number`||!Number.isFinite(n)?{data:ov(),status:`corrupt`,foundVersion:null}:n===1?{data:_v(t),status:`migrated`,foundVersion:1}:n>=2?{data:gv(t),status:n===2?`ok`:`migrated`,foundVersion:n}:{data:ov(),status:`corrupt`,foundVersion:n}}function yv(e){return JSON.stringify(e)}function bv(e){if(e===null||e.length===0)return{data:ov(),status:`absent`,foundVersion:null};let t;try{t=JSON.parse(e)}catch{return{data:ov(),status:`corrupt`,foundVersion:null}}return vv(t)}function xv(){try{let e=globalThis.localStorage;if(e==null)return null;let t=e;return typeof t.getItem!=`function`||typeof t.setItem!=`function`?null:t}catch{return null}}function Sv(e=xv()){if(e===null)return{data:ov(),status:`unavailable`,foundVersion:null};let t;try{t=e.getItem(tv)}catch{return{data:ov(),status:`unavailable`,foundVersion:null}}return bv(t)}function Cv(e,t=xv()){if(t===null)return!1;try{return t.setItem(tv,yv({...e,version:2})),!0}catch{return!1}}function wv(e){return{preset:e.graphics.preset,masterVolume:e.audio.masterVolume,musicVolume:e.audio.musicVolume,muted:e.audio.muted,timeScale:e.world.timeScale,latitudeDeg:e.world.latitudeDeg,longitudeDeg:e.world.longitudeDeg}}var Tv=3;function Ev(e){if(typeof e!=`object`||!e)return null;let t=e;return typeof t.addEventListener!=`function`||typeof t.removeEventListener!=`function`?null:t}function Dv(){let e=[];for(let t of[globalThis.document,globalThis.window]){let n=Ev(t);n!==null&&e.push(n)}return e}var Ov=class{build;storage;debounceMs;targets;timer=null;dirty=!1;failures=0;onLifecycle=()=>{this.flush()};constructor(e,t={}){this.build=e,this.storage=t.storage??xv(),this.debounceMs=t.debounceMs??1500,this.targets=Dv();for(let e of this.targets)e.addEventListener(`visibilitychange`,this.onLifecycle),e.addEventListener(`pagehide`,this.onLifecycle)}schedule(){this.dirty=!0,!(this.timer!==null||this.failures>=Tv)&&(this.timer=setTimeout(()=>{this.timer=null,this.flush()},this.debounceMs))}flush(){return this.timer!==null&&(clearTimeout(this.timer),this.timer=null),!this.dirty||this.failures>=Tv?!1:Cv(this.build(),this.storage)?(this.dirty=!1,this.failures=0,!0):(this.failures+=1,!1)}get pending(){return this.dirty}dispose(){this.flush();for(let e of this.targets)e.removeEventListener(`visibilitychange`,this.onLifecycle),e.removeEventListener(`pagehide`,this.onLifecycle)}},kv=class{name=`ui`;priority=95;hud;catchCard;journal;settingsPanel;inventory=new q_;boat=null;weather=null;fishing=null;progression=null;settings;saver;savedProgression;lastFishingState=`idle`;events=null;eventsKey=``;snapshot={headingRad:0,speedKnots:0,epochMs:Date.now(),utcOffsetMinutes:0,sunriseMs:null,sunsetMs:null,moonriseMs:null,moonsetMs:null,sunAltitudeDeg:0,moonAltitudeDeg:0,moonIlluminatedFraction:0,moonBrightLimbAngle:0,moonNorthAngle:0,moonPhase:`new`,pressureHpa:1013.25,pressureTrendHpaPerHour:0,windSpeed:0,beaufort:0,windDirectionRad:0,lineTension:0,hooked:!1,stormApproaching:!1,stormMinutesAway:0};card={species:``,latin:``,rarity:`common`,massKg:0,lengthM:0,albino:!1,personalBest:!1,firstCatch:!1,value:0};help;helpDismissed=!1;constructor(e,t){this.settings=t,this.hud=new T_(e),this.catchCard=new j_(e),this.journal=new F_(e),this.settingsPanel=new W_(e,t),this.help=Nv(e),this.journal.setSpecies(th);let n=Sv();this.savedProgression=n.data.progression,this.inventory.load(n.data.inventory,n.data.journal),this.refreshJournal(),this.saver=new Ov(()=>this.buildSave()),n.foundVersion!==null&&n.foundVersion<2&&this.saver.schedule()}attach(e){e.boat!==void 0&&(this.boat=e.boat),e.weather!==void 0&&(this.weather=e.weather),e.fishing!==void 0&&(this.fishing=e.fishing,this.lastFishingState=e.fishing.state),e.progression!==void 0&&(this.progression=e.progression,e.progression.load(this.savedProgression))}update(e,t){let n=t.input;n.wasPressed(`journal`)&&this.journal.toggle(),n.wasPressed(`settings`)&&this.settingsPanel.toggle(),this.catchCard.isVisible&&jv(n)&&this.catchCard.dismiss(),this.watchForLanding(t),!this.helpDismissed&&(n.throttleAxis!==0||n.rudderAxis!==0)&&(this.helpDismissed=!0,this.help.classList.add(`is-gone`));let r=t.world.ephemeris;if(r===null)return;this.refreshDayEvents(t);let i=this.snapshot;i.headingRad=this.boat?.heading??0,i.speedKnots=this.boat?.speedKnots??0,i.epochMs=t.time.epochMs,i.utcOffsetMinutes=t.time.timezoneOffsetMinutes,i.sunriseMs=this.events?.sunrise??null,i.sunsetMs=this.events?.sunset??null,i.moonriseMs=this.events?.moonrise??null,i.moonsetMs=this.events?.moonset??null,i.sunAltitudeDeg=r.sunAltitudeDeg,i.moonAltitudeDeg=r.moonAltitudeDeg,i.moonIlluminatedFraction=r.moon.illuminatedFraction,i.moonBrightLimbAngle=r.moon.brightLimbAngle,i.moonNorthAngle=r.moon.northScreenAngle,i.moonPhase=r.moon.phaseName;let a=t.world;i.pressureHpa=a.pressureHpa,i.pressureTrendHpaPerHour=this.weather?.barometricTrendHpaPerHour??0,i.windSpeed=a.windSpeed,i.beaufort=a.beaufort,i.windDirectionRad=a.windDirection,i.lineTension=this.fishing?.tension??0,i.hooked=this.fishing?.hooked??!1;let o=this.weather?.stormWarning;i.stormApproaching=o?.approaching??!1,i.stormMinutesAway=o?.minutesAway??0,this.hud.update(i)}dispose(){this.saver.dispose(),this.hud.dispose(),this.catchCard.dispose(),this.journal.dispose(),this.settingsPanel.dispose()}watchForLanding(e){let t=this.fishing;if(t===null)return;let n=t.state,r=n===`landed`&&this.lastFishingState!==`landed`;if(this.lastFishingState=n,!r)return;let i=t.lastCatch;i!==null&&this.land(i,e.time.epochMs)}land(e,t){let n=this.inventory.record(e,t),r=this.card;r.species=e.species.name,r.latin=e.species.latin,r.rarity=e.species.rarity,r.massKg=n.record.massKg,r.lengthM=n.record.lengthM,r.albino=n.record.albino,r.firstCatch=n.firstCatch,r.personalBest=n.personalBest&&!n.firstCatch,r.value=n.moneyEarned,this.catchCard.show(r),this.refreshJournal(),this.saver.schedule()}refreshJournal(){this.journal.setRecords(this.inventory.journal),this.journal.setSummary(this.inventory.money,this.inventory.totalCatches)}buildSave(){return{version:2,savedAtMs:Date.now(),progression:this.progression?.toData()??this.savedProgression,inventory:this.inventory.toInventoryData(),journal:this.inventory.toJournalData(),settings:wv(this.settings)}}refreshDayEvents(e){let t=e.settings.world,n=new Date(e.time.epochMs),r=`${n.getFullYear()}-${n.getMonth()}-${n.getDate()}:${t.latitudeDeg.toFixed(3)}:${t.longitudeDeg.toFixed(3)}`;r!==this.eventsKey&&(this.eventsKey=r,this.events=t_({latitudeDeg:t.latitudeDeg,longitudeDeg:t.longitudeDeg,elevationM:0},e.time.epochMs))}},Av=[`throttleUp`,`throttleDown`,`rudderLeft`,`rudderRight`,`boost`,`anchor`,`reel`,`cameraMode`,`journal`,`settings`];function jv(e){if(e.primaryPressed)return!0;for(let t of Av)if(e.wasPressed(t))return!0;return!1}var Mv=[[`W / S`,`Throttle`],[`A / D`,`Steer`],[`Shift`,`Boost`],[`Space`,`Anchor — steady the boat to fish`],[`Hold LMB`,`Charge a cast, release to throw`],[`R`,`Reel in — keep the line taut, not tight`],[`C`,`Camera: follow / first person / orbit`],[`J`,`Species journal`],[`Esc`,`Settings — time, location, graphics`]];function Nv(e){let t=document.createElement(`aside`);t.className=`hud-panel help-card`;let n=document.createElement(`h2`);n.textContent=`Endless Fishing`,t.appendChild(n);let r=document.createElement(`dl`);for(let[e,t]of Mv){let n=document.createElement(`dt`);n.textContent=e;let i=document.createElement(`dd`);i.textContent=t,r.append(n,i)}t.appendChild(r);let i=document.createElement(`p`);return i.className=`help-card__hint`,i.textContent=`Anchor first, then cast. Dawn and dusk fish best.`,t.appendChild(i),e.appendChild(t),t}var Pv=9.80665,Fv=1.225,Iv=.028,Lv=.15,Rv=.022,zv=Rv/(bs*(4/3*Math.PI*Iv**3)),Bv=Math.PI*Iv**2,Vv=.5*bs*.47*Bv/Rv,Hv=.5*Fv*.47*Bv/Rv,Uv=6.5,Wv=.55,Gv=26,Kv=.28,qv=new t(0,1,0),Jv=new P,Yv=new t,Xv=new t,Zv=new t,Qv=new P,$v=class{group=new r;position=new t;velocity=new t;orientation=new P;immersion=0;dipsRemaining=0;dipStrength=0;dipTimer=0;geometries=[];surfaces=[];constructor(){let t=new u(Iv,20,8,0,Math.PI*2,0,Math.PI/2),n=new u(Iv,20,8,0,Math.PI*2,Math.PI/2,Math.PI/2),r=new F(.0016,.0024,Lv,6,1),i=new F(.0022,.0014,.055,6,1);r.translate(0,.103,0),i.translate(0,-.0555,0);let a=new we({color:10232088,roughness:.42,metalness:0}),o=new we({color:14209734,roughness:.48,metalness:0}),s=new we({color:15226383,roughness:.55,metalness:0,emissive:15226383,emissiveIntensity:.35}),c=new we({color:2763308,roughness:.3,metalness:.85});this.geometries.push(t,n,r,i),this.surfaces.push(a,o,s,c),this.group.add(new e(t,a),new e(n,o),new e(r,s),new e(i,c)),this.group.visible=!1,this.group.castShadow=!0}get materials(){return this.surfaces}get submergedFraction(){return this.immersion}lineAttachment(e){return Zv.set(0,.166,0).applyQuaternion(this.orientation),e.copy(this.position).add(Zv)}get visible(){return this.group.visible}setVisible(e){this.group.visible=e}launch(e,t){this.position.copy(e),this.velocity.copy(t),this.immersion=0,this.dipsRemaining=0,this.dipStrength=0,this.dipTimer=0,this.group.visible=!0}integrateFlight(e,t,n){let r=this.velocity.x-t,i=this.velocity.z-n,a=Math.hypot(r,this.velocity.y,i),o=Hv*a;this.velocity.x-=r*o*e,this.velocity.z-=i*o*e,this.velocity.y-=(Pv+this.velocity.y*o)*e,this.position.addScaledVector(this.velocity,e),a>.5&&(Xv.set(-this.velocity.x,-this.velocity.y,-this.velocity.z).normalize(),Qv.setFromUnitVectors(qv,Xv),this.orientation.slerp(Qv,1-Math.exp(-4*e)))}hasSplashed(e){return this.position.y<=e.heightAt(this.position.x,this.position.z)}integrateHeave(e,t,n){let r=t.heightAt(this.position.x,this.position.z);t.normalAt(this.position.x,this.position.z,Yv);let i=G(r-(this.position.y-Iv),0,2*Iv);this.immersion=i*i*(3*Iv-i)/(4*Iv**3);let a=this.immersion,o=Vv*a+Hv*(1-a),s=Pv*(a/zv-1)-n*Gv-o*this.velocity.y*Math.abs(this.velocity.y);this.velocity.y+=s*e+this.consumeDip(e),this.position.y+=this.velocity.y*e,this.settleUpright(e)}integrateDrift(e,t,n){let r=this.immersion,i=r*Pv*Wv,a=this.velocity.x-t,o=this.velocity.z-n,s=Hv*Uv*(1-r)*Math.hypot(a,o),c=Vv*r;this.velocity.x+=(Yv.x*i-c*this.velocity.x*Math.abs(this.velocity.x)-a*s)*e,this.velocity.z+=(Yv.z*i-c*this.velocity.z*Math.abs(this.velocity.z)-o*s)*e,this.position.x+=this.velocity.x*e,this.position.z+=this.velocity.z*e}steerTowards(e,t,n,r){let i=1-Math.exp(-r*e),a=(t-this.position.x)*i,o=(n-this.position.z)*i;this.position.x+=a,this.position.z+=o,this.velocity.x=a/Math.max(e,1e-4),this.velocity.z=o/Math.max(e,1e-4)}tether(e,t){Xv.subVectors(this.position,e);let n=Xv.length();if(n<=t||n<1e-5)return;Xv.multiplyScalar(1/n),this.position.copy(e).addScaledVector(Xv,t);let r=this.velocity.dot(Xv);r>0&&this.velocity.addScaledVector(Xv,-r)}dip(e){this.dipStrength=G(e,0,1),this.dipsRemaining=1+Math.round((1-this.dipStrength)*3),this.dipTimer=0}sync(){this.group.position.copy(this.position),this.group.quaternion.copy(this.orientation)}dispose(){this.group.removeFromParent();for(let e of this.geometries)e.dispose();for(let e of this.surfaces)e.dispose();this.geometries.length=0,this.surfaces.length=0}consumeDip(e){if(this.dipsRemaining<=0||(this.dipTimer-=e,this.dipTimer>0))return 0;--this.dipsRemaining,this.dipTimer=Kv;let t=1+.6*(1-this.dipsRemaining/4);return-1.35*(.35+.65*this.dipStrength)*t}settleUpright(e){Qv.setFromUnitVectors(qv,Yv),Qv.slerp(Jv,.38),this.orientation.slerp(Qv,1-Math.exp(-6.5*e))}},ey=`precision highp float;

attribute vec3 aTangent;

attribute float aAlong;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec3 vTangent;
varying float vAlong;
varying float vViewDistance;

void main() {
  vWorldPosition = position;
  vNormal = normalize(normal);
  vTangent = normalize(aTangent);
  vAlong = aAlong;
  vViewDistance = distance(position, cameraPosition);

  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}`,ty=`precision highp float;

#ifndef ENDLESS_FISHING_CONSTANTS\r
#define ENDLESS_FISHING_CONSTANTS

const float PI = 3.14159265358979323846;\r
const float TWO_PI = 6.28318530717958647692;\r
const float HALF_PI = 1.57079632679489661923;\r
const float INV_PI = 0.31830988618379067154;\r
const float INV_FOUR_PI = 0.07957747154594766788;\r
const float DEG_TO_RAD = 0.01745329251994329577;\r
const float RAD_TO_DEG = 57.2957795130823208768;

const float EPS = 1e-6;

#ifndef saturate\r
float saturate(float x) { return clamp(x, 0.0, 1.0); }\r
vec2 saturate(vec2 x) { return clamp(x, 0.0, 1.0); }\r
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }\r
#endif

float ef_luminance(vec3 colour) {\r
  return dot(colour, vec3(0.2126, 0.7152, 0.0722));\r
}

float remap(float x, float lowIn, float highIn, float lowOut, float highOut) {\r
  float span = highIn - lowIn;\r
  float t = span == 0.0 ? step(lowIn, x) : (x - lowIn) / span;\r
  return lowOut + saturate(t) * (highOut - lowOut);\r
}

vec3 hdrClamp(vec3 colour) {\r
  vec3 safe;\r
  safe.x = colour.x == colour.x ? colour.x : 0.0;\r
  safe.y = colour.y == colour.y ? colour.y : 0.0;\r
  safe.z = colour.z == colour.z ? colour.z : 0.0;\r
  
  
  return clamp(safe, vec3(0.0), vec3(60000.0));\r
}

float hdrClampAlpha(float alpha) {\r
  return clamp(alpha == alpha ? alpha : 0.0, 0.0, 1.0);\r
}

#endif

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec3 vTangent;
varying float vAlong;
varying float vViewDistance;

uniform vec3 uSunDirection;
uniform vec3 uSunColour;

uniform float uSunIlluminance;
uniform vec3 uMoonDirection;
uniform vec3 uMoonColour;
uniform float uMoonIlluminance;

uniform vec3 uSkyRadiance;
uniform float uVisibility;
uniform vec3 uLineColour;

uniform float uTension;
uniform float uOpacity;

vec3 ef_filament(vec3 L, vec3 colour, float illuminance, vec3 T, vec3 V, float shine) {
  if (illuminance <= 0.0) return vec3(0.0);
  float horizon = smoothstep(-0.035, 0.02, L.y);
  if (horizon <= 0.0) return vec3(0.0);

  float tDotL = dot(T, L);
  float tDotV = dot(T, V);
  float sinL = sqrt(max(0.0, 1.0 - tDotL * tDotL));
  float sinV = sqrt(max(0.0, 1.0 - tDotV * tDotV));

  float specular = pow(max(0.0, sinL * sinV - tDotL * tDotV), shine);
  return colour * illuminance * horizon * (uLineColour * sinL * INV_PI + vec3(specular));
}

void main() {
  vec3 viewVector = cameraPosition - vWorldPosition;
  vec3 V = viewVector / max(EPS, vViewDistance);
  vec3 T = normalize(vTangent);
  vec3 N = normalize(vNormal);

  
  
  float shine = mix(26.0, 110.0, saturate(uTension));

  vec3 colour = ef_filament(uSunDirection, uSunColour, uSunIlluminance, T, V, shine);
  colour += ef_filament(uMoonDirection, uMoonColour, uMoonIlluminance, T, V, shine * 0.5);
  colour += uLineColour * uSkyRadiance;

  
  
  
  float extinction = 3.912 / max(200.0, uVisibility);
  float haze = 1.0 - exp(-extinction * vViewDistance);
  colour = mix(colour, uSkyRadiance, haze);

  
  
  
  
  float rim = 1.0 - abs(dot(N, V));
  float alpha = uOpacity * mix(0.92, 0.30, smoothstep(3.0, 42.0, vViewDistance));
  alpha *= 0.55 + 0.45 * rim;
  
  
  alpha *= 1.0 - smoothstep(0.94, 1.0, vAlong);
  alpha = saturate(alpha + uTension * 0.14);

  gl_FragColor = vec4(hdrClamp(colour), alpha);
}`,ny=18,ry=5,iy=44,ay=6,oy=.0045,sy=9.80665,cy=.86,ly=new t,uy=new t,dy=new t,fy=new t,py=new t,my=new t,hy=class{mesh;geometry;material;points=new Float32Array(57);previous=new Float32Array(57);positions;normals;tangents;positionAttribute;normalAttribute;tangentAttribute;seeded=!1;constructor(){this.positions=new Float32Array(792),this.normals=new Float32Array(792),this.tangents=new Float32Array(792);let n=new Float32Array(264);for(let e=0;e<iy;e+=1){let t=e/43;for(let r=0;r<ay;r+=1)n[e*ay+r]=t}let r=new Uint16Array(1548),o=0;for(let e=0;e<43;e+=1)for(let t=0;t<ay;t+=1){let n=e*ay+t,i=e*ay+(t+1)%ay,a=n+ay,s=i+ay;r[o]=n,r[o+1]=a,r[o+2]=i,r[o+3]=i,r[o+4]=a,r[o+5]=s,o+=6}this.positionAttribute=new j(this.positions,3),this.normalAttribute=new j(this.normals,3),this.tangentAttribute=new j(this.tangents,3),this.positionAttribute.setUsage(h),this.normalAttribute.setUsage(h),this.tangentAttribute.setUsage(h),this.geometry=new L,this.geometry.setAttribute(`position`,this.positionAttribute),this.geometry.setAttribute(`normal`,this.normalAttribute),this.geometry.setAttribute(`aTangent`,this.tangentAttribute),this.geometry.setAttribute(`aAlong`,new j(n,1)),this.geometry.setIndex(new j(r,1)),this.geometry.boundingSphere=null,this.material=new i({vertexShader:ey,fragmentShader:ty,uniforms:{uSunDirection:{value:new t(0,1,0)},uSunColour:{value:new a(1,.98,.94)},uSunIlluminance:{value:0},uMoonDirection:{value:new t(0,-1,0)},uMoonColour:{value:new a(.72,.8,1)},uMoonIlluminance:{value:0},uSkyRadiance:{value:new a(0,0,0)},uVisibility:{value:25e3},uLineColour:{value:new a(.55,.58,.6)},uTension:{value:0},uOpacity:{value:1}},transparent:!0,depthWrite:!1}),this.mesh=new e(this.geometry,this.material),this.mesh.frustumCulled=!1,this.mesh.renderOrder=3,this.mesh.visible=!1}get visible(){return this.mesh.visible}setVisible(e){this.mesh.visible=e}reset(){this.seeded=!1}updateLighting(e){let t=this.material.uniforms,n=e.ephemeris;if(n!==null){let r=t.uSunDirection;if(r!==void 0){let e=n.sunDirectionRefracted;r.value.set(e.x,e.y,e.z)}let i=t.uMoonDirection;i!==void 0&&i.value.set(n.moonDirection.x,n.moonDirection.y,n.moonDirection.z),vy(t,`uSunIlluminance`,n.sunIlluminanceLux/Math.PI*(1-e.cloudiness*.9)),vy(t,`uMoonIlluminance`,n.moonIlluminanceLux/Math.PI)}let r=t.uSkyRadiance;if(r!==void 0){let t=e.sceneIlluminanceLux/Math.PI;r.value.setRGB(t*.82,t*.9,t)}vy(t,`uVisibility`,e.visibility)}resolve(e,t,n,r,i){this.seeded||=(this.seed(t,n),!0),this.integrate(e),gy(this.points,0,t.x,t.y,t.z),gy(this.points,ny,n.x,n.y,n.z);let a=Math.max(1e-4,r/ny);for(let e=0;e<ry;e+=1)this.relax(a);this.buildTube(i),vy(this.material.uniforms,`uTension`,G(i,0,1))}setOpacity(e){vy(this.material.uniforms,`uOpacity`,G(e,0,1))}dispose(){this.mesh.removeFromParent(),this.geometry.dispose(),this.material.dispose()}seed(e,t){for(let n=0;n<=ny;n+=1){let r=n/ny,i=e.x+(t.x-e.x)*r,a=e.y+(t.y-e.y)*r,o=e.z+(t.z-e.z)*r;gy(this.points,n,i,a,o),gy(this.previous,n,i,a,o)}}integrate(e){let t=Math.min(e,1/60),n=sy*t*t;for(let e=1;e<ny;e+=1){let t=e*3;for(let e=0;e<3;e+=1){let r=this.points[t+e]??0,i=r+(r-(this.previous[t+e]??0))*cy+(e===1?-n:0);this.previous[t+e]=r,this.points[t+e]=i}}}relax(e){for(let t=0;t<ny;t+=1){let n=t*3,r=n+3,i=(this.points[r]??0)-(this.points[n]??0),a=(this.points[r+1]??0)-(this.points[n+1]??0),o=(this.points[r+2]??0)-(this.points[n+2]??0),s=Math.hypot(i,a,o);if(s<=e||s<1e-6)continue;let c=(s-e)/s,l=t===0,u=t+1===ny;if(l&&u)continue;let d=l?0:u?1:.5,f=1-d;this.points[n]=(this.points[n]??0)+i*c*d,this.points[n+1]=(this.points[n+1]??0)+a*c*d,this.points[n+2]=(this.points[n+2]??0)+o*c*d,this.points[r]=(this.points[r]??0)-i*c*f,this.points[r+1]=(this.points[r+1]??0)-a*c*f,this.points[r+2]=(this.points[r+2]??0)-o*c*f}}buildTube(e){let t=oy*(1-.22*G(e,0,1));for(let e=0;e<iy;e+=1){let n=e/43*ny;this.sample(n,my,dy),e===0?(ly.set(+(Math.abs(dy.x)<.9),Math.abs(dy.x)<.9?0:1,0),fy.copy(ly).addScaledVector(dy,-ly.dot(dy)).normalize()):(fy.addScaledVector(dy,-fy.dot(dy)),fy.lengthSq()<1e-10&&fy.set(dy.y,-dy.x,0),fy.normalize()),py.crossVectors(dy,fy);for(let n=0;n<ay;n+=1){let r=n/ay*Math.PI*2,i=Math.cos(r),a=Math.sin(r),o=fy.x*i+py.x*a,s=fy.y*i+py.y*a,c=fy.z*i+py.z*a,l=(e*ay+n)*3;this.positions[l]=my.x+o*t,this.positions[l+1]=my.y+s*t,this.positions[l+2]=my.z+c*t,this.normals[l]=o,this.normals[l+1]=s,this.normals[l+2]=c,this.tangents[l]=dy.x,this.tangents[l+1]=dy.y,this.tangents[l+2]=dy.z}}this.positionAttribute.needsUpdate=!0,this.normalAttribute.needsUpdate=!0,this.tangentAttribute.needsUpdate=!0}sample(e,t,n){let r=Math.min(17,Math.floor(e)),i=e-r;_y(this.points,Math.max(0,r-1),ly),_y(this.points,r,t),_y(this.points,r+1,uy),_y(this.points,Math.min(ny,r+2),n);let a=ly,o=t.x,s=t.y,c=t.z,l=uy,u=n,d=i*i,f=d*i,p=-.5*f+d-.5*i,m=1.5*f-2.5*d+1,h=-1.5*f+2*d+.5*i,g=.5*f-.5*d,_=-1.5*d+2*i-.5,v=4.5*d-5*i,y=-4.5*d+4*i+.5,b=1.5*d-i,x=a.x*_+o*v+l.x*y+u.x*b,S=a.y*_+s*v+l.y*y+u.y*b,C=a.z*_+c*v+l.z*y+u.z*b;t.set(a.x*p+o*m+l.x*h+u.x*g,a.y*p+s*m+l.y*h+u.y*g,a.z*p+c*m+l.z*h+u.z*g);let w=Math.hypot(x,S,C);w<1e-8?n.set(0,1,0):n.set(x/w,S/w,C/w)}};function gy(e,t,n,r,i){let a=t*3;e[a]=n,e[a+1]=r,e[a+2]=i}function _y(e,t,n){let r=t*3;n.set(e[r]??0,e[r+1]??0,e[r+2]??0)}function vy(e,t,n){let r=e[t];r!==void 0&&(r.value=n)}var yy=Math.PI/180,by=.42;function xy(){return{depth:0,weather:0,timeOfDay:0,moon:0,bait:0,structure:0,rare:0,combined:0}}function Sy(e){return G(W(.15,1.6,e)*(.22+.78*Math.exp(-Math.max(0,e-4)/22)),0,1)}function Cy(e,t){let n=Math.max(0,e),r=n<3?2.6:1.9,i=.18+.82*Math.exp(-.5*((n-3)/r)**2),a=1-.55*W(7,11,n),o=G(t,0,1),s=1+.18*W(.02,.25,o)-.62*W(.3,.9,o);return G(i*a*s,0,1)}function wy(e){let t=W(-6,20,e),n=.34*(1-t)+.26*t,r=Math.exp(-.5*((e-3)/6.5)**2);return G(n+(1-n)*r*.92,0,1)}function Ty(e,t){return G((.55+.45*Math.abs(2*G(e,0,1)-1))*(.7+.3*Math.abs(Math.sin(t*yy))),0,1)}var Ey={bare:.12,bread:.35,lure:.6,worm:.7,squid:.75,shrimp:.78,sandeel:.82,"mackerel-strip":.85};function Dy(e){return Ey[e]}function Oy(e,t){let n=.35+.65*Math.exp(-Math.max(0,e)/14),r=.35+.65*Math.exp(-Math.max(0,t)/9);return G(Math.max(n,r),0,1)}function ky(e,t,n){let r=W(3,9,e),i=W(.1,.7,t),a=1-W(-8,4,n);return G(.08+.52*Math.max(r,i)+.24*a+.16*r*a,0,1)}function Ay(e,t){return t.depth=Sy(e.depthM),t.weather=Cy(e.beaufort,e.precipitation),t.timeOfDay=wy(e.sunAltitudeDeg),t.moon=Ty(e.moonIlluminatedFraction,e.moonAltitudeDeg),t.bait=Dy(e.bait),t.structure=Oy(e.structureDistanceM,e.schoolDistanceM),t.rare=ky(e.beaufort,e.precipitation,e.sunAltitudeDeg),t.combined=t.depth*t.weather*t.timeOfDay*t.moon*t.bait*t.structure,G(by*t.combined,0,1)}var jy={depthM:0,sunAltitudeDeg:0,beaufort:0,waterTemperatureC:12,bait:`bare`,rarity:0};function My(e,t,n,r){let i=Ay(e,t);if(r.next()>=1-Math.exp(-i*n))return null;jy.depthM=e.depthM,jy.sunAltitudeDeg=e.sunAltitudeDeg,jy.beaufort=e.beaufort,jy.waterTemperatureC=e.waterTemperatureC,jy.bait=e.bait,jy.rarity=t.rare;let a=oh(jy,r);if(a===void 0)return null;let o=G(.25+.75*r.next()*(.4+.6*t.combined*3),0,1);return{species:a,strike:o,hookWindow:.8+1.4*(1-o)}}var Ny=Math.PI*2,Py=.9,Fy=.07,Iy=.82,Ly=Z_(`line-strength`,0),Ry=.045,zy=.99,By=.3,Vy=.16,Hy=.78,Uy=.92,Wy=.78,Gy=.6,Ky=1.6,qy=.9,Jy=7.5,Yy=3.2,Xy=3.5,Zy=2.4,Qy=3,$y=.42,eb=.8,tb=.3,nb=.7,rb=2.4,ib=.45,ab=.9,ob=.6,sb=1.6,cb=.9,lb=.55,ub=1.5,db=.3,fb=.55,pb={holding:.45,shaking:1,sounding:1.35,running:1.55},mb=.6;function hb(e){return G(Iy+Ry*(Math.max(0,e-Ly)/Ly),Iy,zy)}function gb(e,t){return(lb+ub*e.pull)*(.45+.55*t)}var _b=class{load=0;staminaLeft=0;staminaTotal=1;range=0;doing=`holding`;behaviourLeft=0;slackFor=0;surge=0;shakePhase=0;bearing=0;elapsed=0;get tension(){return this.load}get staminaFraction(){return this.staminaTotal<=0?0:G(this.staminaLeft/this.staminaTotal,0,1)}get distanceM(){return this.range}get behaviour(){return this.doing}get bearingRad(){return this.bearing}get elapsedS(){return this.elapsed}begin(e,t,n,r){this.staminaTotal=Math.max(.001,e.stamina),this.staminaLeft=this.staminaTotal,this.range=Math.max(Py,t),this.bearing=n,this.doing=`running`,this.behaviourLeft=nb+rb*r.next(),this.load=.3*e.pull,this.slackFor=0,this.surge=0,this.shakePhase=0,this.elapsed=0}clear(){this.load=0,this.staminaLeft=0,this.staminaTotal=1,this.range=0,this.doing=`holding`,this.behaviourLeft=0,this.slackFor=0,this.surge=0,this.shakePhase=0,this.elapsed=0}step(e,t,n,r){this.elapsed+=e;let i=this.staminaFraction;this.behaviourLeft-=e,this.behaviourLeft<=0&&this.chooseBehaviour(t,i,r);let a=t.pull*(By+.7*i),o=G(n.reel,0,1),s=this.doing===`running`||this.doing===`sounding`;this.shakePhase+=e*(Ky+qy*t.runRate);let c=this.doing===`shaking`?Math.max(0,Math.sin(this.shakePhase*Ny))**3:0,l=o*(Vy+Hy*a);s&&(l+=Uy*a*(this.doing===`sounding`?Wy:1)),l+=Gy*a*c*G(o+this.load,0,1);let u=G(n.waveHeightM/Xy,0,1);this.surge=K(this.surge,0,Qy,e)+(r.next()*2-1)*u*Zy*e,l*=1+this.surge,this.load=G(K(this.load,l,l>this.load?Jy:Yy,e),0,1);let d=pb[this.doing]+mb*o*this.load;this.staminaLeft=Math.max(0,this.staminaLeft-d*e);let f=s?0:db+.7*(1-i),p=o*n.reelSpeedMps*f*(this.doing===`shaking`?fb:1),m=this.doing===`running`?gb(t,i):0;return this.range=Math.max(0,this.range+(m-p)*e),this.load>=hb(n.lineStrengthN)?`snapped`:(this.slackFor=this.load<Fy?this.slackFor+e:0,this.slackFor>=2.2?`thrown`:this.range<=.9?`landed`:`fighting`)}chooseBehaviour(e,t,n){let r=G(e.runRate*$y*t,0,eb),i=n.next();if(i<r){let r=G(e.pull-e.runRate*.35,.1,.8);this.doing=n.next()<r?`sounding`:`running`,this.behaviourLeft=nb+rb*t*n.next(),this.bearing+=(n.next()*2-1)*cb;return}if(i<r+tb){this.doing=`shaking`,this.behaviourLeft=ib+ab*n.next(),this.shakePhase=0;return}this.doing=`holding`,this.behaviourLeft=ob+sb*(1-.5*t)*n.next()}},vb={idle:[`charging`],charging:[`casting`],casting:[`sinking`],sinking:[`waiting`],waiting:[`bite`,`idle`],bite:[`fighting`,`escaped`],fighting:[`landed`,`escaped`],landed:[`idle`],escaped:[`idle`]};function yb(e,t){return vb[e].includes(t)}var bb=class{current=`idle`;get state(){return this.current}to(e,t){return this.current!==e||!yb(this.current,t)?!1:(this.current=t,!0)}reset(){this.current=`idle`}},xb=9.80665,Sb=1.15,Cb=38*Math.PI/180,wb=5,Tb=34,Eb=.55,Db=Z_(`reel-speed`,0),Ob=12,kb=.6,Ab=.8,jb=.7,Mb=.09,Nb=1.06,Pb=1.1,Fb=1.3,Ib=.75,Lb=3.5,Rb=2,zb=1.6,Bb=1.2,Vb=5e3,Hb=7,Ub=6,Wb=90,Gb=7,Kb=8,qb=45,Jb=.85,$=new t,Yb=new t,Xb=new t,Zb=new t;function Qb(e){return Tb*(1+Eb*(e/Db-1))}function $b(e){return Math.sqrt(Math.max(0,e)*xb/Math.sin(2*Cb))}var ex=class{name=`fishing`;priority=40;machine=new bb;bobber=new $v;line=new hy;fight=new _b;rng;water;ground;rod;schools;effects;factors=xy();conditions={depthM:0,beaufort:0,precipitation:0,sunAltitudeDeg:0,moonIlluminatedFraction:0,moonAltitudeDeg:0,bait:`worm`,structureDistanceM:Wb,schoolDistanceM:Vb,waterTemperatureC:12};fightConditions={reel:0,reelSpeedMps:0,lineStrengthN:0,waveHeightM:0};charge=0;onTheHook=null;landedFish=null;strikeStrength=0;hookWindowLeft=0;baitDepth=0;riggedDepth=Ab;lineOut=0;structureDistance=Wb;dwellLeft=0;bait=`worm`;constructor(e,t,n,r,i,a,o){this.water=t,this.ground=n,this.rod=r,this.schools=i,this.effects=a,this.rng=new H(o),e.scene.add(this.bobber.group),e.scene.add(this.line.mesh)}get state(){return this.machine.state}get chargeFraction(){return this.machine.state===`charging`?this.charge:0}get tension(){return this.machine.state===`fighting`?this.fight.tension:0}get fishStamina(){return this.machine.state===`fighting`?this.fight.staminaFraction:0}get fishDistanceM(){return this.machine.state===`fighting`?this.fight.distanceM:0}get hookedSpecies(){return this.onTheHook}get lastCatch(){return this.landedFish}get hooked(){return this.machine.state===`fighting`}get baitDepthM(){return this.baitDepth}get lineOutM(){return this.lineOut}get baitKind(){return this.bait}setBait(e){this.bait=e}get materials(){return this.bobber.materials}update(e,t){let n=t.input;switch(this.machine.state){case`idle`:n.primaryPressed&&this.canCast()&&this.beginCharge();break;case`charging`:(n.primaryReleased||!n.primaryDown)&&this.releaseCast(t);break;case`bite`:n.primaryPressed&&this.setHook();break;case`landed`:case`escaped`:n.primaryPressed&&(this.dwellLeft=0)}this.line.updateLighting(t.world),this.refreshStructure(),this.drawTackle(e)}fixedUpdate(e,t){switch(this.machine.state){case`idle`:break;case`charging`:this.charge=G(this.charge+e/Sb,0,1);break;case`casting`:this.stepFlight(e,t);break;case`sinking`:this.stepSink(e,t);break;case`waiting`:this.stepWaiting(e,t);break;case`bite`:this.stepBite(e,t);break;case`fighting`:this.stepFight(e,t);break;case`landed`:this.dwellLeft-=e,this.settleFloat(e,t,0),this.dwellLeft<=0&&this.machine.to(`landed`,`idle`)&&this.stow();break;case`escaped`:this.dwellLeft-=e,this.settleFloat(e,t,0),this.dwellLeft<=0&&this.machine.to(`escaped`,`idle`)&&this.stow()}}dispose(){this.bobber.dispose(),this.line.dispose(),this.schools?.clearBait()}canCast(){return this.rod.isAnchored?!0:Math.hypot(this.rod.velocity.x,this.rod.velocity.z)<Fb}beginCharge(){this.machine.to(`idle`,`charging`)&&(this.charge=0)}releaseCast(e){if(!this.machine.to(`charging`,`casting`))return;this.rod.rodTipWorldPosition($),e.camera.getWorldDirection(Xb),Xb.y=0,Xb.lengthSq()<1e-6&&Xb.set(0,0,-1),Xb.normalize();let t=$b(wb+(Qb(this.effects.reelSpeedMps)-wb)*this.charge),n=Math.cos(Cb)*t;Zb.set(Xb.x*n,Math.sin(Cb)*t,Xb.z*n),Zb.add(this.rod.velocity),this.bobber.launch($,Zb),this.line.reset(),this.line.setVisible(!0),this.line.setOpacity(1),this.lineOut=Bb,this.baitDepth=0,this.charge=0}stepFlight(e,t){let n=t.world;if(this.bobber.integrateFlight(e,n.windX,n.windZ),!this.bobber.hasSplashed(this.water))return;let r=this.bobber.velocity.length();r>Pb&&this.bobber.velocity.multiplyScalar(Pb/r),this.rod.rodTipWorldPosition($),this.lineOut=Math.max(Bb,$.distanceTo(this.bobber.position)*Nb),this.machine.to(`casting`,`sinking`)}stepSink(e,t){this.settleFloat(e,t,0),this.riggedDepth=this.fishingDepth(),this.baitDepth=Math.min(this.riggedDepth,this.baitDepth+jb*e),this.baitDepth>=this.riggedDepth&&this.machine.to(`sinking`,`waiting`)}stepWaiting(e,t){if(t.input.isHeld(`reel`)){this.retrieve(e);return}this.settleFloat(e,t,0),this.riggedDepth=this.fishingDepth(),this.baitDepth=Math.min(this.riggedDepth,this.baitDepth+jb*e);let n=this.markBait();this.buildConditions(t.world,n);let r=My(this.conditions,this.factors,e*this.effects.lureQuality,this.rng);r!==null&&(this.onTheHook=r.species,this.strikeStrength=r.strike,this.hookWindowLeft=r.hookWindow,this.bobber.dip(r.strike),this.machine.to(`waiting`,`bite`))}stepBite(e,t){this.settleFloat(e,t,Ib*this.strikeStrength),this.hookWindowLeft-=e,!(this.hookWindowLeft>0)&&this.machine.to(`bite`,`escaped`)&&this.beginDwell(zb)}setHook(){let e=this.onTheHook;if(e===null)return;this.rod.rodTipWorldPosition($);let t=this.bobber.position.x-$.x,n=this.bobber.position.z-$.z,r=Math.hypot(t,n);this.machine.to(`bite`,`fighting`)&&this.fight.begin(e,r,Math.atan2(t,n),this.rng)}stepFight(e,t){let n=this.onTheHook;if(n===null)return;let r=t.world,i=this.fightConditions;i.reel=t.input.isHeld(`reel`)||t.input.primaryDown?1:0,i.reelSpeedMps=this.effects.reelSpeedMps,i.lineStrengthN=this.effects.lineStrengthN,i.waveHeightM=r.significantWaveHeight;let a=this.fight.step(e,n,i,this.rng);this.rod.rodTipWorldPosition($);let o=this.fight.bearingRad,s=this.fight.distanceM;switch(this.bobber.steerTowards(e,$.x+Math.sin(o)*s,$.z+Math.cos(o)*s,Lb),this.bobber.integrateHeave(e,this.water,this.fight.tension),this.lineOut=Math.max(Bb,s),a){case`fighting`:break;case`landed`:this.landedFish=sh(n,this.rng),this.machine.to(`fighting`,`landed`)&&this.beginDwell(Rb);break;case`snapped`:case`thrown`:this.machine.to(`fighting`,`escaped`)&&this.beginDwell(zb)}}retrieve(e){this.rod.rodTipWorldPosition($),this.lineOut=Math.max(Bb,this.lineOut-this.effects.reelSpeedMps*e),this.bobber.integrateHeave(e,this.water,0),this.bobber.tether($,this.lineOut);let t=this.bobber.position.x-$.x,n=this.bobber.position.z-$.z;Math.hypot(t,n)>Bb||this.machine.to(`waiting`,`idle`)&&this.stow()}settleFloat(e,t,n){let r=t.world;this.bobber.integrateHeave(e,this.water,n),this.bobber.integrateDrift(e,r.windX,r.windZ),this.rod.rodTipWorldPosition($),this.bobber.tether($,this.lineOut)}fishingDepth(){let e=this.water.heightAt(this.bobber.position.x,this.bobber.position.z),t=this.ground.floorHeightAt(this.bobber.position.x,this.bobber.position.z);return G(Math.max(0,e-t)-kb,Ab,Ob)}markBait(){let e=this.schools;if(e===null)return 0;let t=this.water.heightAt(this.bobber.position.x,this.bobber.position.z);return e.setBait(this.bobber.position.x,t-this.baitDepth,this.bobber.position.z,Jb),G(e.schoolBoost(this.bobber.position),0,1)}buildConditions(e,t){let n=this.conditions,r=e.ephemeris;n.depthM=this.baitDepth,n.beaufort=e.beaufort,n.precipitation=e.precipitation,n.sunAltitudeDeg=r===null?0:r.sunAltitudeDeg,n.moonIlluminatedFraction=r===null?0:r.moon.illuminatedFraction,n.moonAltitudeDeg=r===null?0:r.moonAltitudeDeg,n.bait=this.bait,n.structureDistanceM=this.structureDistance,n.schoolDistanceM=t<=0?Vb:Math.min(Vb,-9*Math.log(t)),n.waterTemperatureC=e.temperatureC-(e.temperatureC-Gb)*W(Kb,qb,this.baitDepth)}refreshStructure(){if(!this.bobber.visible){this.structureDistance=Wb;return}let e=this.bobber.position.x,t=this.bobber.position.z,n=this.ground.floorHeightAt(e,t),r=Math.max(Math.abs(this.ground.floorHeightAt(e+Hb,t)-n),Math.abs(this.ground.floorHeightAt(e-Hb,t)-n),Math.abs(this.ground.floorHeightAt(e,t+Hb)-n),Math.abs(this.ground.floorHeightAt(e,t-Hb)-n));this.structureDistance=Wb*(1-W(.4,Ub,r))}drawTackle(e){if(!this.bobber.visible)return;this.rod.rodTipWorldPosition($),this.bobber.lineAttachment(Yb);let t=$.distanceTo(Yb),n=this.tension,r=Math.max(this.lineOut,t)*(1+Mb*(1-n));this.line.resolve(e,$,Yb,r,n),this.bobber.sync()}beginDwell(e){this.dwellLeft=e,this.schools?.clearBait(),this.line.setOpacity(.35)}stow(){this.bobber.setVisible(!1),this.line.setVisible(!1),this.line.reset(),this.fight.clear(),this.schools?.clearBait(),this.onTheHook=null,this.charge=0,this.strikeStrength=0,this.hookWindowLeft=0,this.baitDepth=0,this.lineOut=0,this.dwellLeft=0,this.structureDistance=Wb}},tx={"Africa/Cairo":[30.04,31.24],"Africa/Johannesburg":[-26.2,28.05],"Africa/Lagos":[6.52,3.38],"Africa/Nairobi":[-1.29,36.82],"America/Anchorage":[61.22,-149.9],"America/Argentina/Buenos_Aires":[-34.6,-58.38],"America/Bogota":[4.71,-74.07],"America/Chicago":[41.88,-87.63],"America/Denver":[39.74,-104.99],"America/Halifax":[44.65,-63.57],"America/Lima":[-12.05,-77.04],"America/Los_Angeles":[34.05,-118.24],"America/Mexico_City":[19.43,-99.13],"America/New_York":[40.71,-74.01],"America/Sao_Paulo":[-23.55,-46.63],"America/Toronto":[43.65,-79.38],"America/Vancouver":[49.28,-123.12],"Asia/Bangkok":[13.76,100.5],"Asia/Dubai":[25.2,55.27],"Asia/Hong_Kong":[22.32,114.17],"Asia/Jakarta":[-6.21,106.85],"Asia/Jerusalem":[32.08,34.78],"Asia/Kolkata":[22.57,88.36],"Asia/Manila":[14.6,120.98],"Asia/Seoul":[37.57,126.98],"Asia/Shanghai":[31.23,121.47],"Asia/Singapore":[1.35,103.82],"Asia/Tokyo":[35.68,139.69],"Atlantic/Reykjavik":[64.15,-21.94],"Australia/Brisbane":[-27.47,153.03],"Australia/Melbourne":[-37.81,144.96],"Australia/Perth":[-31.95,115.86],"Australia/Sydney":[-33.87,151.21],"Europe/Amsterdam":[52.37,4.9],"Europe/Athens":[37.98,23.73],"Europe/Berlin":[52.52,13.4],"Europe/Brussels":[50.85,4.35],"Europe/Copenhagen":[55.68,12.57],"Europe/Dublin":[53.35,-6.26],"Europe/Helsinki":[60.17,24.94],"Europe/Istanbul":[41.01,28.98],"Europe/Lisbon":[38.72,-9.14],"Europe/London":[51.51,-.13],"Europe/Madrid":[40.42,-3.7],"Europe/Moscow":[55.76,37.62],"Europe/Oslo":[59.91,10.75],"Europe/Paris":[48.86,2.35],"Europe/Prague":[50.08,14.44],"Europe/Rome":[41.9,12.5],"Europe/Stockholm":[59.33,18.07],"Europe/Vienna":[48.21,16.37],"Europe/Warsaw":[52.23,21.01],"Europe/Zurich":[47.38,8.54],"Pacific/Auckland":[-36.85,174.76],"Pacific/Honolulu":[21.31,-157.86]};function nx(){let e=``;try{e=Intl.DateTimeFormat().resolvedOptions().timeZone??``}catch{e=``}let t=tx[e];return t===void 0?{latitudeDeg:Qe,longitudeDeg:$e,source:`default`}:{latitudeDeg:t[0],longitudeDeg:t[1],source:`timezone`}}function rx(){let e=nx();return typeof navigator>`u`||navigator.geolocation===void 0?Promise.resolve(e):new Promise(t=>{let n=!1,r=e=>{n||(n=!0,t(e))};navigator.geolocation.getCurrentPosition(e=>{r({latitudeDeg:e.coords.latitude,longitudeDeg:e.coords.longitude,source:`geolocation`})},()=>r(e),{enableHighAccuracy:!1,timeout:8e3,maximumAge:6e5}),window.setTimeout(()=>r(e),9e3)})}async function ix(){let e=new kt;e.set(.02,`Probing graphics capabilities`);let t=document.getElementById(`scene`);if(!(t instanceof HTMLCanvasElement))throw Error(`Canvas #scene is missing from index.html`);let n=await lt(t);e.set(.15,`Renderer ready`);let r=new Dt(n);n.debug=r,n.resources.onProgress((t,n,r)=>{let i=n===0?1:t/n;e.set(.15+i*.8,`Loading ${r.split(`/`).pop()??r}`)});let i=nx();n.settings.setLocationIfUnset(i.latitudeDeg,i.longitudeDeg),rx().then(e=>{e.source===`geolocation`&&n.settings.setLocation(e.latitudeDeg,e.longitudeDeg)});let a=await Er.create(n);n.add(a),a.onSettingsChanged(n);let o=new Ia(n);n.add(o);let s=new to(n);n.add(s);let c=new $r(n);c.setCloudShadows(s),n.add(c),n.add(new gi);let l=new Of(n,c);n.add(l);let u=new Gf(n,c);n.add(u),l.setOptics(u),e.set(.45,`Raising land`);let d=new vs(n.resources),f=await gm.create(n,d);n.add(f);let p=await Qm.create(n,d,f.field);p.setSwell(c),n.add(p),e.set(.55,`Building the boat`);let m=await gl.create(n,c,d);n.add(m),n.add(new wu(n,c,m));let h=new qh(n,c,l,m);h.setOptics(u),n.add(h),n.add(new Bo(n));let g=new Wg(n);g.setSea(c),n.add(g);for(let e of m.materials)a.registerShadowMaterial(e);n.add(new Zl(n,m,c)),n.add(new hs(n));let _=new $_,v=new ex(n,c,l,m,h,_.effects,n.settings.world.seed^61783);n.add(v);for(let e of v.materials)a.registerShadowMaterial(e);let y=document.getElementById(`ui-root`);if(y===null)throw Error(`#ui-root is missing from index.html`);let b=new kv(y,n.settings);b.attach({boat:m,weather:o,fishing:v,progression:_}),n.add(b),n.add(new Xd(n,{boat:m,underwater:u,weather:o,tackle:v})),Ot(n),e.set(.96,`Compiling shaders`),n.start(),await new Promise(e=>{requestAnimationFrame(()=>requestAnimationFrame(()=>e()))}),e.finish(),window.addEventListener(`beforeunload`,()=>{r.dispose(),n.dispose()})}ix().catch(e=>{let t=e instanceof Error?e.message:String(e);t.includes(`WebGL2`)?At(`WebGL2 required`,`This browser cannot create a WebGL2 context. Try a recent Chrome, Edge, Firefox or Safari, and make sure hardware acceleration is enabled.`):At(`Failed to start`,t)});
//# sourceMappingURL=index-DUpHSu8K.js.map
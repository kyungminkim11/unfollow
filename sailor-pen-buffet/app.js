import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const parts = [
  { id: 'cap_top', nameKo: '캡탑', nameEn: 'CAP TOP', description: '캡의 가장 위쪽을 둥글게 마감하는 파츠입니다.' },
  { id: 'cap_body', nameKo: '캡', nameEn: 'CAP BODY', description: '프로피트 주니어 특유의 완만한 곡선을 만드는 캡 본체입니다.' },
  { id: 'grip_section', nameKo: '그립 섹션', nameEn: 'GRIP SECTION', description: '필기할 때 손가락이 닿는 테이퍼형 파츠입니다.' },
  { id: 'center_ring_or_connector', nameKo: '중앙 연결 파츠', nameEn: 'CENTER CONNECTOR', description: '그립 섹션과 배럴을 연결하며 조합의 경계를 만드는 파츠입니다.' },
  { id: 'barrel_body', nameKo: '배럴', nameEn: 'BARREL BODY', description: '만년필 몸통의 가장 넓은 면적을 차지하는 메인 파츠입니다.' },
  { id: 'barrel_end', nameKo: '배럴엔드', nameEn: 'BARREL END', description: '배럴 끝을 둥글게 마감하여 전체 실루엣을 완성합니다.' },
];

const colors = [
  { id: 'clear', code: 'CL', nameKo: '클리어', nameEn: 'Clear', hex: '#dce8ee', transparent: true },
  { id: 'white', code: 'WH', nameKo: '화이트', nameEn: 'White', hex: '#f4f2eb' },
  { id: 'black', code: 'BK', nameKo: '블랙', nameEn: 'Black', hex: '#17191d' },
  { id: 'navy', code: 'NV', nameKo: '네이비', nameEn: 'Navy', hex: '#203452' },
  { id: 'blue', code: 'BL', nameKo: '블루', nameEn: 'Blue', hex: '#3b72a6' },
  { id: 'sky', code: 'SB', nameKo: '스카이 블루', nameEn: 'Sky Blue', hex: '#82b9cf' },
  { id: 'green', code: 'GN', nameKo: '그린', nameEn: 'Green', hex: '#47745c' },
  { id: 'yellow', code: 'YL', nameKo: '옐로', nameEn: 'Yellow', hex: '#d9b84d' },
  { id: 'pink', code: 'PK', nameKo: '핑크', nameEn: 'Pink', hex: '#d89aad' },
  { id: 'red', code: 'RD', nameKo: '레드', nameEn: 'Red', hex: '#a64649' },
];

const defaultSelection = Object.fromEntries(parts.map((part) => [part.id, 'clear']));
const state = { activePartId: parts[0].id, selections: { ...defaultSelection }, viewMode: 'open', autoRotate: true, root: null, capGroup: null, meshByPart: new Map() };
for (const part of parts) {
  const value = new URLSearchParams(location.search).get(part.id);
  if (colors.some((color) => color.id === value)) state.selections[part.id] = value;
}

const canvas = document.querySelector('#pen-canvas');
const canvasWrap = document.querySelector('#canvas-wrap');
const loadingPanel = document.querySelector('#loading-panel');
const modelError = document.querySelector('#model-error');
const partTabs = document.querySelector('#part-tabs');
const swatchGrid = document.querySelector('#swatch-grid');
const summaryList = document.querySelector('#summary-list');
const copyFeedback = document.querySelector('#copy-feedback');
document.querySelector('#loading-progress').textContent = '모델 구성 중';

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 1000);
camera.position.set(0, 42, 165);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.minDistance = 95;
controls.maxDistance = 260;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;
controls.target.set(0, 0, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x8e9aaa, 2.15));
const keyLight = new THREE.DirectionalLight(0xffffff, 3.4);
keyLight.position.set(45, 70, 85);
keyLight.castShadow = true;
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xc6dbff, 1.6);
fillLight.position.set(-55, 18, 50);
scene.add(fillLight);
const rimLight = new THREE.DirectionalLight(0xffebca, 1.35);
rimLight.position.set(20, -25, -50);
scene.add(rimLight);

const ground = new THREE.Mesh(new THREE.CircleGeometry(112, 96), new THREE.ShadowMaterial({ color: 0x263548, opacity: 0.13 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -20;
ground.receiveShadow = true;
scene.add(ground);

const fixedMetal = new THREE.MeshStandardMaterial({ color: 0xc8ccd1, metalness: 0.92, roughness: 0.18 });
const darkMetal = new THREE.MeshStandardMaterial({ color: 0x555b63, metalness: 0.65, roughness: 0.25 });
const feedMaterial = new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.34 });
const darkInset = new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.42 });

function customMaterial() {
  return new THREE.MeshPhysicalMaterial({ color: 0xdce8ee, roughness: 0.16, metalness: 0, clearcoat: 0.65, clearcoatRoughness: 0.14, transparent: true, opacity: 0.46, transmission: 0.12, thickness: 1.1, side: THREE.DoubleSide });
}
function latheMesh(name, profile, material = customMaterial(), segments = 96) {
  const points = profile.map(([axis, radius]) => new THREE.Vector2(radius, axis));
  const geometry = new THREE.LatheGeometry(points, segments);
  geometry.rotateZ(-Math.PI / 2);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
function cylinderAlongX(radius, length, material, radialSegments = 80) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, radialSegments), material);
  mesh.rotation.z = Math.PI / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
function addRing(parent, x, radius, width, material = fixedMetal, name = '') {
  const ring = cylinderAlongX(radius, width, material, 96);
  ring.position.x = x;
  ring.name = name;
  parent.add(ring);
  return ring;
}
function makeNib() {
  const shape = new THREE.Shape();
  shape.moveTo(-36, 0);
  shape.quadraticCurveTo(-31, 4.5, -20, 5.1);
  shape.lineTo(-18, 3.8);
  shape.lineTo(-18, -3.8);
  shape.lineTo(-20, -5.1);
  shape.quadraticCurveTo(-31, -4.5, -36, 0);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.7, bevelEnabled: true, bevelSize: 0.18, bevelThickness: 0.12, bevelSegments: 2 });
  geometry.translate(0, 0, -0.35);
  const nib = new THREE.Mesh(geometry, fixedMetal.clone());
  nib.name = 'nib';
  nib.rotation.x = -0.13;
  nib.position.z = 0.8;
  nib.castShadow = true;
  const slit = new THREE.Mesh(new THREE.BoxGeometry(11, 0.18, 0.12), darkInset.clone());
  slit.name = 'nib_slit';
  slit.position.set(-27.5, 0, 1.18);
  nib.add(slit);
  const hole = cylinderAlongX(0.65, 0.18, darkInset.clone(), 40);
  hole.rotation.set(Math.PI / 2, 0, 0);
  hole.position.set(-24.2, 0, 1.22);
  hole.name = 'nib_breather_hole';
  nib.add(hole);
  return nib;
}
function makeClip() {
  const group = new THREE.Group();
  group.name = 'clip_group';
  const stem = new THREE.Mesh(new THREE.CapsuleGeometry(0.9, 37, 6, 14), fixedMetal.clone());
  stem.rotation.z = Math.PI / 2;
  stem.position.set(-31, 0, 7.6);
  stem.scale.y = 0.76;
  stem.name = 'clip';
  stem.castShadow = true;
  group.add(stem);
  const anchor = new THREE.Mesh(new THREE.SphereGeometry(2.2, 48, 24), fixedMetal.clone());
  anchor.scale.set(1.25, 0.75, 0.55);
  anchor.position.set(-51.2, 0, 7.25);
  anchor.name = 'clip_anchor';
  group.add(anchor);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(1.8, 40, 20), fixedMetal.clone());
  tip.scale.set(1.45, 0.72, 0.52);
  tip.position.set(-10.4, 0, 7.3);
  tip.name = 'clip_tip';
  group.add(tip);
  return group;
}
function buildPenModel() {
  if (state.root) scene.remove(state.root);
  state.meshByPart.clear();
  const root = new THREE.Group();
  root.name = 'profit_junior_preview';
  root.rotation.y = -0.06;
  root.rotation.x = 0.02;
  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'body_group';
  bodyGroup.add(latheMesh('grip_section', [[-18, 3.35], [-16.5, 3.72], [-13, 4.08], [-6, 4.32], [0, 4.82], [4.2, 5.4]]));
  bodyGroup.add(latheMesh('center_ring_or_connector', [[4.2, 5.45], [5.2, 6.25], [9.5, 6.38], [11.5, 6.55], [13.0, 6.6]]));
  bodyGroup.add(latheMesh('barrel_body', [[13.0, 6.58], [19, 6.7], [36, 6.95], [55, 7.02], [70, 6.82], [80.5, 6.15]]));
  bodyGroup.add(latheMesh('barrel_end', [[80.5, 6.15], [84, 5.65], [88, 4.42], [90.5, 2.4], [91.4, 0.55]]));
  addRing(bodyGroup, 3.65, 5.65, 0.7, fixedMetal.clone(), 'connector_ring_fixed');
  addRing(bodyGroup, 12.65, 6.78, 0.55, fixedMetal.clone(), 'barrel_ring_fixed');
  const feed = cylinderAlongX(2.72, 16.5, feedMaterial.clone(), 72);
  feed.position.x = -26.1;
  feed.position.y = -1.05;
  feed.name = 'feed';
  bodyGroup.add(feed);
  bodyGroup.add(makeNib());
  root.add(bodyGroup);
  const capGroup = new THREE.Group();
  capGroup.name = 'cap_group';
  capGroup.add(latheMesh('cap_body', [[-55, 6.35], [-51, 6.72], [-38, 7.1], [-20, 7.35], [-7.5, 7.35], [-1.5, 7.28], [0, 7.25]]));
  capGroup.add(latheMesh('cap_top', [[-65.2, 0.6], [-64.3, 2.5], [-62, 4.6], [-58.3, 5.9], [-55, 6.35]]));
  addRing(capGroup, -2.0, 7.48, 1.65, fixedMetal.clone(), 'cap_band_main');
  addRing(capGroup, -4.1, 7.42, 0.42, fixedMetal.clone(), 'cap_band_thin');
  addRing(capGroup, -6.0, 7.36, 0.28, fixedMetal.clone(), 'cap_band_hairline');
  const innerLip = addRing(capGroup, -0.15, 6.72, 1.1, darkMetal.clone(), 'inner_cap_lip');
  innerLip.material.roughness = 0.34;
  capGroup.add(makeClip());
  root.add(capGroup);
  for (const part of parts) {
    const mesh = root.getObjectByName(part.id);
    if (mesh?.isMesh) state.meshByPart.set(part.id, mesh);
  }
  state.root = root;
  state.capGroup = capGroup;
  scene.add(root);
  updateModelLayout();
  applyAllColors();
  loadingPanel.hidden = true;
  modelError.hidden = true;
}
function updateModelLayout() {
  if (!state.capGroup) return;
  if (state.viewMode === 'open') {
    state.capGroup.position.set(14, 28, 0);
    state.capGroup.rotation.x = 0.015;
    state.root.position.set(-12, -8, 0);
    camera.position.set(0, 46, 176);
    controls.minDistance = 100;
    controls.maxDistance = 260;
    ground.position.y = -22;
  } else {
    state.capGroup.position.set(29.4, 0, 0);
    state.capGroup.rotation.x = 0;
    state.root.position.set(-10, 0, 0);
    camera.position.set(0, 28, 170);
    controls.minDistance = 90;
    controls.maxDistance = 230;
    ground.position.y = -13;
  }
  controls.target.set(0, 0, 0);
  controls.update();
}
function applyMaterial(mesh, color) {
  const material = mesh.material;
  material.color.set(color.hex);
  material.metalness = 0;
  material.roughness = color.transparent ? 0.09 : 0.17;
  material.clearcoat = 0.72;
  material.clearcoatRoughness = 0.12;
  material.transparent = Boolean(color.transparent);
  material.opacity = color.transparent ? 0.45 : 1;
  material.transmission = color.transparent ? 0.12 : 0;
  material.depthWrite = !color.transparent;
  material.side = color.transparent ? THREE.DoubleSide : THREE.FrontSide;
  material.emissive = new THREE.Color(state.activePartId === mesh.name ? color.hex : '#000000');
  material.emissiveIntensity = state.activePartId === mesh.name ? 0.035 : 0;
  material.needsUpdate = true;
}
function applyAllColors() {
  for (const part of parts) {
    const mesh = state.meshByPart.get(part.id);
    const color = getColor(state.selections[part.id]);
    if (mesh && color) applyMaterial(mesh, color);
  }
}
function getColor(colorId) { return colors.find((color) => color.id === colorId) ?? colors[0]; }
function setQueryString() {
  const params = new URLSearchParams();
  for (const part of parts) params.set(part.id, state.selections[part.id]);
  history.replaceState(null, '', `${location.pathname}?${params.toString()}`);
}
function combinationCode() { return `BB-SAILOR-${parts.map((part) => getColor(state.selections[part.id]).code).join('-')}`; }
function selectPart(partId) { state.activePartId = partId; applyAllColors(); renderControls(); }
function renderPartTabs() {
  partTabs.replaceChildren(...parts.map((part, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'part-tab';
    button.role = 'tab';
    button.textContent = `${index + 1}. ${part.nameKo}`;
    button.setAttribute('aria-selected', String(state.activePartId === part.id));
    button.addEventListener('click', () => selectPart(part.id));
    return button;
  }));
}
function renderSwatches() {
  const activeColorId = state.selections[state.activePartId];
  swatchGrid.replaceChildren(...colors.map((color) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'swatch-button';
    button.role = 'radio';
    button.setAttribute('aria-checked', String(activeColorId === color.id));
    button.setAttribute('aria-label', `${color.nameKo} 선택`);
    button.innerHTML = `<span class="swatch-circle${color.transparent ? ' transparent' : ''}" style="background:${color.hex}"></span><span>${color.nameKo}</span>`;
    button.addEventListener('click', () => {
      state.selections[state.activePartId] = color.id;
      setQueryString();
      applyAllColors();
      renderControls();
    });
    return button;
  }));
}
function renderSummary() {
  summaryList.replaceChildren(...parts.map((part) => {
    const color = getColor(state.selections[part.id]);
    const item = document.createElement('div');
    item.className = 'summary-item';
    item.innerHTML = `<span class="summary-dot" style="background:${color.hex}"></span><div><small>${part.nameKo}</small><b>${color.nameKo}</b></div>`;
    return item;
  }));
  document.querySelector('#combination-code').textContent = combinationCode();
}
function renderControls() {
  const activeIndex = parts.findIndex((part) => part.id === state.activePartId);
  const part = parts[activeIndex];
  const color = getColor(state.selections[part.id]);
  document.querySelector('#progress-text').textContent = `${activeIndex + 1} / ${parts.length}`;
  document.querySelector('#part-name-en').textContent = part.nameEn;
  document.querySelector('#part-name-ko').textContent = part.nameKo;
  document.querySelector('#part-description').textContent = part.description;
  document.querySelector('#selected-color-name').textContent = `${color.nameKo} · ${color.nameEn}`;
  document.querySelector('#selected-color-dot').style.background = color.hex;
  renderPartTabs();
  renderSwatches();
  renderSummary();
}
function resizeRenderer() {
  const width = canvasWrap.clientWidth;
  const height = canvasWrap.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resizeRenderer).observe(canvasWrap);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
canvas.addEventListener('pointerup', (event) => {
  if (!state.root || event.pointerType === 'touch') return;
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects([...state.meshByPart.values()], false)[0];
  if (hit?.object?.name) selectPart(hit.object.name);
});
function animate() { controls.autoRotate = state.autoRotate; controls.update(); renderer.render(scene, camera); requestAnimationFrame(animate); }
function showFeedback(message) {
  copyFeedback.textContent = message;
  window.setTimeout(() => { if (copyFeedback.textContent === message) copyFeedback.textContent = ''; }, 2600);
}
document.querySelector('#toggle-rotate').addEventListener('click', (event) => {
  state.autoRotate = !state.autoRotate;
  event.currentTarget.textContent = `자동 회전 ${state.autoRotate ? '켬' : '끔'}`;
  event.currentTarget.setAttribute('aria-pressed', String(state.autoRotate));
});
document.querySelector('#toggle-view').addEventListener('click', (event) => {
  state.viewMode = state.viewMode === 'open' ? 'closed' : 'open';
  event.currentTarget.textContent = state.viewMode === 'open' ? '완성 상태 보기' : '파츠 분리 보기';
  document.querySelector('#view-title').textContent = state.viewMode === 'open' ? '파츠 분리 보기' : '완성 상태 보기';
  updateModelLayout();
});
document.querySelector('#copy-link').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(location.href); showFeedback('조합 링크를 복사했습니다.'); }
  catch { showFeedback('주소창의 링크를 직접 복사해 주세요.'); }
});
document.querySelector('#save-image').addEventListener('click', () => {
  renderer.render(scene, camera);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `${combinationCode()}.png`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
    showFeedback('현재 3D 화면을 이미지로 저장했습니다.');
  }, 'image/png');
});
document.querySelector('#reset-combination').addEventListener('click', () => {
  state.selections = { ...defaultSelection };
  state.activePartId = parts[0].id;
  setQueryString();
  applyAllColors();
  renderControls();
  showFeedback('기본 조합으로 초기화했습니다.');
});

renderControls();
resizeRenderer();
window.setTimeout(buildPenModel, 80);
animate();

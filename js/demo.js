const API_BASE = 'https://om4ouplt6b7iorwkbl4sckvdtu0quatf.lambda-url.ap-southeast-1.on.aws';
const VIDEO_URL = 'https://creatorsflow.cc/assets/demo/spring-launch-cut-01.mp4';

const params = new URLSearchParams(window.location.search);
const storedOpenId = window.localStorage.getItem('creatorflow_tiktok_open_id');
const state = {
  openId: params.get('open_id') || storedOpenId || '',
  publishId: '',
  user: null
};

const connectButton = document.getElementById('connect-button');
const submitButton = document.getElementById('submit-button');
const statusButton = document.getElementById('status-button');
const accountBox = document.getElementById('account-box');
const connectionStatus = document.getElementById('connection-status');
const publishStatus = document.getElementById('publish-status');
const publishId = document.getElementById('publish-id');
const activityLog = document.getElementById('activity-log');
const responseBox = document.getElementById('response-box');
const videoPreview = document.getElementById('video-preview');
const videoUrlLabel = document.getElementById('video-url');
const captionInput = document.getElementById('caption');

function now() {
  return new Date().toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function addLog(message) {
  const item = document.createElement('li');
  item.innerHTML = `<time>${now()}</time><span>${message}</span>`;
  activityLog.appendChild(item);
  item.scrollIntoView({ block: 'nearest' });
}

function setJson(payload) {
  responseBox.textContent = JSON.stringify(payload, null, 2);
}

function setStatus(element, text, className) {
  element.textContent = text;
  element.className = `status ${className || ''}`.trim();
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(payload.message || payload.error || `Request failed: ${response.status}`);
    error.payload = payload;
    throw error;
  }
  return payload;
}

function connectTikTok() {
  addLog('Redirecting to the backend OAuth start endpoint.');
  window.location.href = `${API_BASE}/auth/tiktok/start`;
}

async function loadConnectedUser() {
  if (!state.openId) {
    addLog('No TikTok account is connected yet. Click Connect TikTok to start the real OAuth flow.');
    return;
  }

  window.localStorage.setItem('creatorflow_tiktok_open_id', state.openId);
  setStatus(connectionStatus, 'Loading user', 'is-busy');
  addLog(`OAuth callback returned open_id ${state.openId}. Fetching TikTok user info through the backend.`);

  try {
    const payload = await api(`/tiktok/user?open_id=${encodeURIComponent(state.openId)}`);
    state.user = payload.data?.user || payload.data || payload;
    const displayName = state.user.display_name || 'Connected TikTok user';
    const avatar = state.user.avatar_url;
    accountBox.innerHTML = `
      ${avatar ? `<img class="avatar avatar--image" src="${avatar}" alt="">` : '<div class="avatar">TT</div>'}
      <div>
        <strong>${displayName}</strong>
        <p>Connected with user.info.basic. Open ID is stored server-side with the TikTok access token.</p>
      </div>
    `;
    setStatus(connectionStatus, 'Connected', 'is-done');
    submitButton.disabled = false;
    connectButton.textContent = 'Reconnect TikTok';
    setJson(payload);
    addLog('Backend called TikTok /v2/user/info/ and returned the connected account identity.');
  } catch (error) {
    setStatus(connectionStatus, 'User load failed', 'is-error');
    setJson(error.payload || { error: error.message });
    addLog(`Could not fetch TikTok user info: ${error.message}`);
  }
}

async function submitDraft() {
  if (!state.openId) return;

  setStatus(publishStatus, 'Submitting', 'is-busy');
  submitButton.disabled = true;
  statusButton.disabled = true;
  publishId.textContent = 'Creating...';
  addLog('Calling backend /tiktok/inbox-video/init with source=PULL_FROM_URL and the public demo video URL.');

  try {
    const payload = await api('/tiktok/inbox-video/init', {
      method: 'POST',
      body: JSON.stringify({
        openId: state.openId,
        videoUrl: VIDEO_URL,
        title: captionInput.value
      })
    });
    state.publishId = payload.data?.publish_id || payload.publish_id || payload.data?.publishId || '';
    publishId.textContent = state.publishId || 'No publish_id in response';
    setStatus(publishStatus, 'Submitted', 'is-ready');
    statusButton.disabled = !state.publishId;
    setJson(payload);
    addLog('TikTok Content Posting API accepted the upload initialization request.');
  } catch (error) {
    setStatus(publishStatus, 'Submit failed', 'is-error');
    submitButton.disabled = false;
    publishId.textContent = 'Not created';
    setJson(error.payload || { error: error.message });
    addLog(`Upload initialization failed: ${error.message}`);
  }
}

async function checkStatus() {
  if (!state.openId || !state.publishId) return;

  setStatus(publishStatus, 'Checking', 'is-busy');
  addLog(`Calling backend /tiktok/publish/status for publish_id ${state.publishId}.`);

  try {
    const payload = await api('/tiktok/publish/status', {
      method: 'POST',
      body: JSON.stringify({
        openId: state.openId,
        publishId: state.publishId
      })
    });
    const status = payload.data?.status || payload.status || 'Status received';
    setStatus(publishStatus, status, 'is-done');
    setJson(payload);
    addLog(`TikTok returned publish status: ${status}.`);
  } catch (error) {
    setStatus(publishStatus, 'Status failed', 'is-error');
    setJson(error.payload || { error: error.message });
    addLog(`Status check failed: ${error.message}`);
  }
}

function showCallbackErrors() {
  const error = params.get('tiktok_error');
  if (!error) return;
  setStatus(connectionStatus, 'OAuth error', 'is-error');
  setJson({ tiktok_error: error });
  addLog(`OAuth callback returned an error: ${error}.`);
}

connectButton.addEventListener('click', connectTikTok);
submitButton.addEventListener('click', submitDraft);
statusButton.addEventListener('click', checkStatus);

videoPreview.src = VIDEO_URL;
videoUrlLabel.textContent = VIDEO_URL;
showCallbackErrors();
loadConnectedUser();

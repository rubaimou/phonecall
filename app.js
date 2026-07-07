const urlParams = new URLSearchParams(window.location.search);
const sharedRoomToken = urlParams.get('room');
// Generate unique string token if fallback room container isn't requested directly
const runtimeId = sharedRoomToken || 'call-' + Math.floor(Math.random() * 900000 + 100000);

const peer = new Peer(runtimeId);

let localStream;
let activeCalls = {};
let activeConnections = {};
let html5QrcodeScanner;
let micMuted = false;
let mediaRecorder;
let voiceChunks = [];
let isRecording = false;

// DOM mapping elements
const myIdDisplay = document.getElementById('my-id');
const statusText = document.getElementById('status-text');
const callBtn = document.getElementById('call-btn');
const hangupBtn = document.getElementById('hangup-btn');
const muteBtn = document.getElementById('mute-btn');
const remoteIdInput = document.getElementById('remote-id');
const scanBtn = document.getElementById('scan-btn');
const readerBox = document.getElementById('reader');
const chatBox = document.getElementById('chat-box');
const msgInputContainer = document.getElementById('msg-input-container');
const msgInput = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');
const emojiBtn = document.getElementById('emoji-btn');
const emojiPanel = document.getElementById('emoji-panel');
const fileInput = document.getElementById('file-input');
const fileTrigger = document.getElementById('file-trigger');
const voiceBtn = document.getElementById('voice-btn');

const emojis = ['😀','😂','🔥','👍','❤️','🎉','🚀','😮','😢','✅','❌','📝'];

// Initialize WebRTC Node Engine 
peer.on('open', (id) => {
    myIdDisplay.innerText = id;
    statusText.innerText = "Status: Ready";
    
    document.getElementById("qrcode").innerHTML = ""; 
    new QRCode(document.getElementById("qrcode"), {
        text: window.location.origin + window.location.pathname + "?room=" + id,
        width: 128,
        height: 128
    });

    if(sharedRoomToken) {
        remoteIdInput.value = sharedRoomToken;
        statusText.innerText = "Status: Shared Token Found. Tap Connect.";
    }
});

async function getMicrophone() {
    if (localStream) return localStream;
    try {
        return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (err) {
        statusText.innerText = "Error: Access to microphone denied.";
    }
}

muteBtn.onclick = () => {
    if (!localStream) return;
    micMuted = !micMuted;
    localStream.getAudioTracks().forEach(track => track.enabled = !micMuted);
    muteBtn.innerText = micMuted ? "Unmute Microphone" : "Mute Microphone";
    muteBtn.style.background = micMuted ? "#28a745" : "#6c757d";
};

// Connect Trigger (Supports both Direct Peer Address and Group mesh Rooms)
callBtn.onclick = async () => {
    const destinationTarget = remoteIdInput.value.trim();
    if (!destinationTarget) return alert("Please specify a target Call or Room ID!");

    statusText.innerText = "Connecting...";
    localStream = await getMicrophone();
    
    if (localStream) {
        showCommunicationSuite();
        
        const conn = peer.connect(destinationTarget);
        handleChatEvents(conn);
        
        const call = peer.call(destinationTarget, localStream);
        handleCallEvents(call);
    }
};

peer.on('connection', (conn) => {
    handleChatEvents(conn);
});

peer.on('call', async (incomingCall) => {
    localStream = await getMicrophone();
    if (localStream) {
        incomingCall.answer(localStream);
        handleCallEvents(incomingCall);
        showCommunicationSuite();
    }
});

function showCommunicationSuite() {
    callBtn.style.display = "none";
    scanBtn.style.display = "none";
    hangupBtn.style.display = "block";
    muteBtn.style.display = "block";
    chatBox.style.display = "block";
    msgInputContainer.style.display = "block";
    statusText.innerText = "Status: Call Connected";
}

function handleCallEvents(call) {
    activeCalls[call.peer] = call;
    call.on('stream', (remoteStream) => {
        let audio = document.getElementById('audio-' + call.peer);
        if (!audio) {
            audio = document.createElement('audio');
            audio.id = 'audio-' + call.peer;
            audio.autoplay = true;
            document.body.appendChild(audio);
        }
        audio.srcObject = remoteStream;
    });
    call.on('close', () => disconnectNode(call.peer));
}

function handleChatEvents(conn) {
    activeConnections[conn.peer] = conn;
    conn.on('data', (data) => {
        if (data.type === 'text') appendMessage(data.payload, 'them', data.sender);
        if (data.type === 'file') appendFileMessage(data.payload, data.fileName, 'them', data.sender);
        if (data.type === 'voice') appendVoiceMessage(data.payload.binary, 'them', data.sender);
    });
    conn.on('close', () => disconnectNode(conn.peer));
}

// Global Chat Broadcasting Engine
sendBtn.onclick = () => {
    const message = msgInput.value.trim();
    if (!message) return;
    
    broadcastPayload({ type: 'text', payload: message, sender: runtimeId });
    appendMessage(message, 'me', 'Me');
    msgInput.value = "";
    emojiPanel.style.display = "none";
};

emojis.forEach(emoji => {
    const span = document.createElement('span');
    span.innerText = emoji;
    span.onclick = () => msgInput.value += emoji;
    emojiPanel.appendChild(span);
});
emojiBtn.onclick = () => {
    emojiPanel.style.display = emojiPanel.style.display === "grid" ? "none" : "grid";
};

// Binary File Mapping Functionality
fileTrigger.onclick = () => fileInput.click();
fileInput.onchange = () => {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        const filePayload = { binary: reader.result, name: file.name };
        broadcastPayload({ type: 'file', payload: filePayload, fileName: file.name, sender: runtimeId });
        appendFileMessage(filePayload, file.name, 'me', 'Me');
    };
    reader.readAsDataURL(file);
};

// Media Recording Hook Logic
voiceBtn.onclick = async () => {
    if (!isRecording) {
        const stream = await getMicrophone();
        if (!stream) return;

        voiceChunks = [];
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) voiceChunks.push(e.data); };

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(voiceChunks, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onload = () => {
                const voicePayload = { binary: reader.result, name: `Voice-${Date.now()}.webm` };
                broadcastPayload({ type: 'voice', payload: voicePayload, sender: runtimeId });
                appendVoiceMessage(voicePayload.binary, 'me', 'Me');
            };
            reader.readAsDataURL(audioBlob);
        };

        mediaRecorder.start();
        isRecording = true;
        voiceBtn.innerText = "🛑 Stop";
        voiceBtn.style.background = "#dc3545";
    } else {
        if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
        isRecording = false;
        voiceBtn.innerText = "🎙️ Record";
        voiceBtn.style.background = "#ffc107";
    }
};

function broadcastPayload(dataObject) {
    Object.values(activeConnections).forEach(conn => {
        if(conn.open) conn.send(dataObject);
    });
}

function appendMessage(text, type, senderName) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('msg', type);
    msgDiv.innerHTML = `<strong>${shortenId(senderName)}:</strong> ${text}`;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function appendFileMessage(fileData, name, type, senderName) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('msg', type);
    msgDiv.innerHTML = `<strong>${shortenId(senderName)}:</strong> file uploaded:<br>
    <a class="file-link" href="${fileData.binary || fileData}" download="${name}">💾 Download ${name}</a>`;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function appendVoiceMessage(audioSrc, type, senderName) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('msg', type);
    msgDiv.innerHTML = `<strong>${shortenId(senderName)}:</strong> voice note:<br>
    <audio controls src="${audioSrc}" style="width: 100%; margin-top: 5px; height: 32px;"></audio>`;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function shortenId(id) {
    if (id === 'Me') return 'Me';
    return id.substring(0, 7) + '...';
}

scanBtn.onclick = () => {
    if (readerBox.style.display === "block") { stopScanner(); return; }
    readerBox.style.display = "block";
    scanBtn.innerText = "Close Scanner";
    html5QrcodeScanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 230, height: 230 } });
    html5QrcodeScanner.render((text) => {
        remoteIdInput.value = new URL(text).searchParams.get('room') || text;
        statusText.innerText = "Connection ID Parsed!";
        stopScanner();
    }, () => {});
};

function stopScanner() {
    if (html5QrcodeScanner) html5QrcodeScanner.clear().catch(() => {});
    readerBox.style.display = "none";
    scanBtn.innerText = "Scan Connection QR Code";
}

function disconnectNode(peerId) {
    if(activeCalls[peerId]) { activeCalls[peerId].close(); delete activeCalls[peerId]; }
    if(activeConnections[peerId]) { activeConnections[peerId].close(); delete activeConnections[peerId]; }
    const audio = document.getElementById('audio-' + peerId);
    if(audio) audio.remove();
}

hangupBtn.onclick = () => {
    Object.keys(activeCalls).forEach(disconnectNode);
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    localStream = null;
    callBtn.style.display = "block";
    scanBtn.style.display = "block";
    hangupBtn.style.display = "none";
    muteBtn.style.display = "none";
    chatBox.style.display = "none";
    msgInputContainer.style.display = "none";
    statusText.innerText = "Status: Disconnected";
    chatBox.innerHTML = "";
};

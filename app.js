const peer = new Peer();

let localStream;
let currentCall;
let dataConnection; // Handles the text messaging channel

// UI Elements
const myIdDisplay = document.getElementById('my-id');
const statusText = document.getElementById('status-text');
const callBtn = document.getElementById('call-btn');
const hangupBtn = document.getElementById('hangup-btn');
const remoteIdInput = document.getElementById('remote-id');
const chatBox = document.getElementById('chat-box');
const msgInputContainer = document.getElementById('msg-input-container');
const msgInput = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');

// 1. When connected, display ID, generate QR code, and auto-fill incoming QR links
peer.on('open', (id) => {
    myIdDisplay.innerText = id;
    statusText.innerText = "Status: Ready";

    // Generate QR Code containing this exact ID
    document.getElementById("qrcode").innerHTML = ""; // Clear loader
    new QRCode(document.getElementById("qrcode"), {
        text: id,
        width: 128,
        height: 128
    });

    // Automatically check if an ID was provided via URL parameter (e.g., site.com/?id=YOUR-ID)
    const urlParams = new URLSearchParams(window.location.search);
    const sharedId = urlParams.get('id');
    if (sharedId) {
        remoteIdInput.value = sharedId;
    }
});

// Microphone permission helper
async function getMicrophone() {
    try {
        return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (err) {
        statusText.innerText = "Error: Cannot access microphone.";
        console.error(err);
    }
}

// 2. Handle OUTGOING Call and Text Connection
callBtn.onclick = async () => {
    const friendId = remoteIdInput.value.trim();
    if (!friendId) return alert("Please enter your friend's ID!");

    statusText.innerText = "Status: Connecting...";
    localStream = await getMicrophone();
    
    if (localStream) {
        // Start audio call
        const call = peer.call(friendId, localStream);
        handleCallEvents(call);

        // Start text message connection
        const conn = peer.connect(friendId);
        handleChatEvents(conn);
    }
};

// 3. Handle INCOMING Call and Text Connection
peer.on('call', async (incomingCall) => {
    if (!confirm("Incoming voice call! Do you want to answer?")) {
        incomingCall.close();
        return;
    }

    statusText.innerText = "Status: Connecting...";
    localStream = await getMicrophone();

    if (localStream) {
        incomingCall.answer(localStream);
        handleCallEvents(incomingCall);
    }
});

// Listen for incoming message connections
peer.on('connection', (conn) => {
    handleChatEvents(conn);
});

// 4. Handle Voice Streams
function handleCallEvents(call) {
    currentCall = call;
    callBtn.style.display = "none";
    hangupBtn.style.display = "block";

    call.on('stream', (remoteStream) => {
        statusText.innerText = "Status: Call Connected";
        let audio = document.getElementById('remote-audio') || document.createElement('audio');
        audio.id = 'remote-audio';
        audio.autoplay = true;
        audio.srcObject = remoteStream;
        document.body.appendChild(audio);
    });

    call.on('close', () => resetUI());
}

// 5. Handle Live Messaging Chat Room
function handleChatEvents(conn) {
    dataConnection = conn;
    chatBox.style.display = "block";
    msgInputContainer.style.display = "block";

    // Listen for text data payloads
    conn.on('data', (data) => {
        appendMessage(data, 'them');
    });

    conn.on('close', () => resetUI());
}

// Sending a Message
sendBtn.onclick = () => {
    const message = msgInput.value.trim();
    if (!message || !dataConnection) return;

    dataConnection.send(message); // Send text to peer
    appendMessage(message, 'me');
    msgInput.value = "";
};

function appendMessage(text, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('msg', sender);
    msgDiv.innerText = text;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll down
}

// Hang Up logic
hangupBtn.onclick = () => {
    if (currentCall) currentCall.close();
    if (dataConnection) dataConnection.close();
    resetUI();
};

function resetUI() {
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    callBtn.style.display = "block";
    hangupBtn.style.display = "none";
    chatBox.style.display = "none";
    msgInputContainer.style.display = "none";
    statusText.innerText = "Status: Disconnected";
    chatBox.innerHTML = "";
}

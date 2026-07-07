const peer = new Peer();

let localStream;
let currentCall;
let dataConnection;
let html5QrcodeScanner; // Variable to store camera scanner instance

// UI Elements
const myIdDisplay = document.getElementById('my-id');
const statusText = document.getElementById('status-text');
const callBtn = document.getElementById('call-btn');
const hangupBtn = document.getElementById('hangup-btn');
const remoteIdInput = document.getElementById('remote-id');
const scanBtn = document.getElementById('scan-btn');
const readerBox = document.getElementById('reader');
const chatBox = document.getElementById('chat-box');
const msgInputContainer = document.getElementById('msg-input-container');
const msgInput = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');

// 1. Setup Identity & QR Generator
peer.on('open', (id) => {
    myIdDisplay.innerText = id;
    statusText.innerText = "Status: Ready";

    document.getElementById("qrcode").innerHTML = ""; 
    new QRCode(document.getElementById("qrcode"), {
        text: id,
        width: 128,
        height: 128
    });
});

// 2. CAMERA QR SCANNER LOGIC
scanBtn.onclick = () => {
    // Toggle the camera section visibility
    if (readerBox.style.display === "block") {
        stopScanner();
        return;
    }

    readerBox.style.display = "block";
    scanBtn.innerText = "Close Camera Scanner";

    // Initialize the scanner engine
    html5QrcodeScanner = new Html5QrcodeScanner("reader", { 
        fps: 10, 
        qrbox: { width: 250, height: 250 } 
    });

    // Run the scanner process
    html5QrcodeScanner.render(onScanSuccess, onScanFailure);
};

// What happens when the camera successfully reads a QR Code
function onScanSuccess(decodedText) {
    remoteIdInput.value = decodedText; // Auto-fill the input box with your friend's ID!
    statusText.innerText = "Status: QR Code Scanned Successfully!";
    stopScanner(); // Automatically turn off camera
}

function onScanFailure(error) {
    // Keep scanning quietly until it detects a valid code
}

function stopScanner() {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(err => console.error(err));
    }
    readerBox.style.display = "none";
    scanBtn.innerText = "Open Camera Scanner";
}

// 3. VOICE AND CALL CONNECTIONS LOGIC
async function getMicrophone() {
    try {
        return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (err) {
        statusText.innerText = "Error: Cannot access microphone.";
    }
}

callBtn.onclick = async () => {
    const friendId = remoteIdInput.value.trim();
    if (!friendId) return alert("Please type or scan a Call ID first!");

    statusText.innerText = "Status: Connecting...";
    localStream = await getMicrophone();
    
    if (localStream) {
        const call = peer.call(friendId, localStream);
        handleCallEvents(call);
        const conn = peer.connect(friendId);
        handleChatEvents(conn);
    }
};

peer.on('call', async (incomingCall) => {
    if (!confirm("Incoming call! Do you want to answer?")) {
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

peer.on('connection', (conn) => {
    handleChatEvents(conn);
});

function handleCallEvents(call) {
    currentCall = call;
    callBtn.style.display = "none";
    hangupBtn.style.display = "block";

    call.on('stream', (remoteStream) => {
        statusText.innerText = "Status: Connected";
        let audio = document.getElementById('remote-audio') || document.createElement('audio');
        audio.id = 'remote-audio';
        audio.autoplay = true;
        audio.srcObject = remoteStream;
        document.body.appendChild(audio);
    });
    call.on('close', () => resetUI());
}

// 4. TEXT MESSAGE CHAT ROOM LOGIC
function handleChatEvents(conn) {
    dataConnection = conn;
    chatBox.style.display = "block";
    msgInputContainer.style.display = "block";

    conn.on('data', (data) => appendMessage(data, 'them'));
    conn.on('close', () => resetUI());
}

sendBtn.onclick = () => {
    const message = msgInput.value.trim();
    if (!message || !dataConnection) return;

    dataConnection.send(message);
    appendMessage(message, 'me');
    msgInput.value = "";
};

function appendMessage(text, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('msg', sender);
    msgDiv.innerText = text;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

hangupBtn.onclick = () => {
    if (currentCall) currentCall.close();
    if (dataConnection) dataConnection.close();
    resetUI();
};

function resetUI() {
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    stopScanner();
    callBtn.style.display = "block";
    hangupBtn.style.display = "none";
    chatBox.style.display = "none";
    msgInputContainer.style.display = "none";
    statusText.innerText = "Status: Disconnected";
    chatBox.innerHTML = "";
}

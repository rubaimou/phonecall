// Initialize PeerJS using their free public cloud signaling server
const peer = new Peer();

let localStream;
let currentCall;

const myIdDisplay = document.getElementById('my-id');
const statusText = document.getElementById('status-text');
const callBtn = document.getElementById('call-btn');
const hangupBtn = document.getElementById('hangup-btn');
const remoteIdInput = document.getElementById('remote-id');

// 1. Display your unique ID once connected to PeerJS network
peer.on('open', (id) => {
    myIdDisplay.innerText = id;
    statusText.innerText = "Status: Ready to connect";
});

// 2. Get local microphone permissions early
async function getMicrophone() {
    try {
        return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (err) {
        statusText.innerText = "Error: Cannot access microphone.";
        console.error(err);
    }
}

// 3. Handle OUTGOING calls
callBtn.onclick = async () => {
    const friendId = remoteIdInput.value.trim();
    if (!friendId) return alert("Please enter your friend's ID first!");

    statusText.innerText = "Status: Accessing microphone...";
    localStream = await getMicrophone();
    
    if (localStream) {
        statusText.innerText = "Status: Ringing...";
        const call = peer.call(friendId, localStream);
        handleCallEvents(call);
    }
};

// 4. Handle INCOMING calls
peer.on('call', async (incomingCall) => {
    const accept = confirm("Incoming voice call! Do you want to answer?");
    if (!accept) {
        incomingCall.close();
        return;
    }

    statusText.innerText = "Status: Accessing microphone...";
    localStream = await getMicrophone();

    if (localStream) {
        incomingCall.answer(localStream); // Answer with your audio stream
        handleCallEvents(incomingCall);
    } else {
        incomingCall.close();
    }
});

// 5. Track Call Streams and Disconnections
function handleCallEvents(call) {
    currentCall = call;
    callBtn.style.display = "none";
    hangupBtn.style.display = "block";

    // When the remote audio stream arrives, play it
    call.on('stream', (remoteStream) => {
        statusText.innerText = "Status: Connected / In Call";
        
        // Create an invisible audio element to play the sound
        let audio = document.getElementById('remote-audio');
        if (!audio) {
            audio = document.createElement('audio');
            audio.id = 'remote-audio';
            audio.autoplay = true;
            document.body.appendChild(audio);
        }
        audio.srcObject = remoteStream;
    });

    call.on('close', () => {
        resetUI();
    });
}

// 6. Handle Hang Up
hangupBtn.onclick = () => {
    if (currentCall) currentCall.close();
    resetUI();
};

function resetUI() {
    if (localStream) {
        // Turn off microphone hardware
        localStream.getTracks().forEach(track => track.stop());
    }
    callBtn.style.display = "block";
    hangupBtn.style.display = "none";
    statusText.innerText = "Status: Call ended";
}

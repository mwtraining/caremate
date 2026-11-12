const STORAGE_KEYS = {
  mode: 'aiCareMode',
  theme: 'aiCareTheme',
  contrast: 'aiCareContrast',
  fontScale: 'aiCareFontScale',
  voice: 'aiCareVoice',
  contacts: 'aiCareContacts',
  reminders: 'aiCareReminders',
  waterLogs: 'aiCareWaterLogs',
  safetyCheckins: 'aiCareSafetyCheckins',
  elderlyMood: 'aiCareElderlyMood',
  wellnessMedicineStatuses: 'aiCareWellnessMedicineStatuses',
  lastLocation: 'aiCareLastLocation',
  sosState: 'aiCareSosState',
  medicineLogs: 'aiCareMedicineLogs',
  launchMode: 'aiCareLaunchMode',
  userIdentifier: 'aiCareUserIdentifier',
  profileModes: 'aiCareProfileModes',
  profileName: 'aiCareProfileName',
  profileAge: 'aiCareProfileAge',
  profileGender: 'aiCareProfileGender',
  profileBloodGroup: 'aiCareProfileBloodGroup',
  preExistingDiseases: 'aiCarePreExistingDiseases',
  diseasesByMode: 'aiCareDiseasesByMode',
  profileWhatsapp: 'aiCareProfileWhatsapp',
  emergencyContactName: 'aiCareEmergencyContactName',
  emergencyContactWhatsapp: 'aiCareEmergencyContactWhatsapp',
  secondaryEmergencyContactName: 'aiCareSecondaryEmergencyContactName',
  secondaryEmergencyContactWhatsapp: 'aiCareSecondaryEmergencyContactWhatsapp'
};

const DEFAULT_CONTACTS = [];

const DEFAULT_REMINDERS = [
  { id: 'm1', name: 'Vitamin reminder', time: '08:00', frequency: 'daily' },
  { id: 'm2', name: 'Medicine reminder', time: '20:00', frequency: 'daily' }
];

const REMINDER_FREQUENCY_LABELS = {
  weekly: 'Weekly',
  monthly: 'Monthly'
};

const REMINDER_DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DEFAULT_WATER_LOGS = [
  { date: 'today', value: 2 },
  { date: 'today', value: 3 }
];

const DISEASE_OPTIONS = [
  'None',
  'High blood pressure',
  'Type 1 diabetes',
  'Type 2 diabetes',
  'Heart disease',
  'High cholesterol',
  'Stroke',
  'Asthma',
  'COPD',
  'Chronic kidney disease',
  'Chronic liver disease',
  'Thyroid disorder',
  'Epilepsy',
  'Arthritis',
  'Osteoporosis',
  'Anemia',
  'Cancer',
  'Tuberculosis',
  'HIV/AIDS',
  'Depression',
  'Anxiety disorder',
  'Autoimmune disease',
  'Migraine',
  'Obesity',
  'Allergies'
];

const state = {
  mode: 'women',
  theme: 'dark',
  fontScale: 1,
  contrast: false,
  voiceEnabled: true,
  sosActive: false,
  currentLocation: null,
  contacts: [],
  reminders: [],
  waterLogs: [],
  checkins: [],
  moodLog: {},
  medicineLogs: {},
  wellnessMedicineStatuses: {},
  lastEmergencyMessage: '',
  userIdentifier: null,
  profileModes: ['women'],
  profileName: '',
  profileAge: 0,
  profileGender: '',
  profileBloodGroup: '',
  diseasesByMode: { women: [], elderly: [] },
  profileWhatsapp: '',
  emergencyContactName: '',
  emergencyContactWhatsapp: '',
  secondaryEmergencyContactName: '',
  secondaryEmergencyContactWhatsapp: ''
};

let homeWellnessDraftDirty = false;
let homeWellnessEditing = false;
let medicineReminderAudioContext = null;
let medicineReminderAudioUnavailable = false;

function safeStorageGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (error) {
    showToast('Local storage is unavailable. Some settings may not be saved.');
    return fallback;
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    showToast('Unable to save settings in this browser.');
    return false;
  }
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(showToast.timerId);
  showToast.timerId = setTimeout(() => {
    toast.classList.remove('visible');
  }, 2600);
}

function normalizeLoginIdentifier(value) {
  const identifier = value.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
    return identifier.toLowerCase();
  }

  const digits = identifier.replace(/\D/g, '');
  if (/^[+\d\s().-]+$/.test(identifier) && digits.length >= 10 && digits.length <= 15) {
    return identifier;
  }

  return null;
}

function openDashboard() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');
  document.getElementById('signedInIdentifier').textContent = state.userIdentifier;
  const modeModal = document.getElementById('modeModal');
  if (!safeStorageGet(STORAGE_KEYS.mode, null)) {
    modeModal.classList.remove('hidden');
  }
}

function signOut() {
  try {
    localStorage.removeItem(STORAGE_KEYS.userIdentifier);
  } catch (error) {
    showToast('Unable to clear the local sign-in state.');
  }
  state.userIdentifier = null;
  document.getElementById('appShell').classList.add('hidden');
  document.getElementById('modeModal').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('loginIdentifier').value = '';
  document.getElementById('loginError').textContent = '';
  applyLaunchMode('browser');
  document.getElementById('appModeToggle').style.display = 'none';
  document.getElementById('loginIdentifier').focus();
}

function getCurrentDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function ensureDemoData() {
  state.contacts = safeStorageGet(STORAGE_KEYS.contacts, DEFAULT_CONTACTS);
  if (!Array.isArray(state.contacts) || state.contacts.length === 0) {
    state.contacts = DEFAULT_CONTACTS;
  }

  state.reminders = safeStorageGet(STORAGE_KEYS.reminders, DEFAULT_REMINDERS);
  if (!Array.isArray(state.reminders) || state.reminders.length === 0) {
    state.reminders = DEFAULT_REMINDERS;
  }
  state.reminders = state.reminders.map((reminder) => ({
    ...reminder,
    time: normalizeReminderTime(reminder.time),
    frequency: normalizeReminderFrequency(reminder.frequency),
    daysOfWeek: normalizeReminderDays(reminder.daysOfWeek, reminder.frequency),
    monthDay: normalizeReminderMonthDay(reminder.monthDay)
  }));

  state.waterLogs = safeStorageGet(STORAGE_KEYS.waterLogs, DEFAULT_WATER_LOGS);
  if (!Array.isArray(state.waterLogs)) {
    state.waterLogs = DEFAULT_WATER_LOGS;
  }
  state.waterLogs = state.waterLogs.map((entry) => ({
    ...entry,
    date: entry.date === 'today' ? getCurrentDateKey() : entry.date,
    value: Number(entry.value || 0)
  }));

  state.checkins = safeStorageGet(STORAGE_KEYS.safetyCheckins, []);
  if (!Array.isArray(state.checkins)) {
    state.checkins = [];
  }

  state.moodLog = safeStorageGet(STORAGE_KEYS.elderlyMood, {});
  if (typeof state.moodLog !== 'object' || state.moodLog === null) {
    state.moodLog = {};
  }

  state.medicineLogs = safeStorageGet(STORAGE_KEYS.medicineLogs, {});
  if (typeof state.medicineLogs !== 'object' || state.medicineLogs === null) {
    state.medicineLogs = {};
  }

  state.wellnessMedicineStatuses = safeStorageGet(STORAGE_KEYS.wellnessMedicineStatuses, {});
  if (typeof state.wellnessMedicineStatuses !== 'object' || state.wellnessMedicineStatuses === null || Array.isArray(state.wellnessMedicineStatuses)) {
    state.wellnessMedicineStatuses = {};
  }

  state.currentLocation = safeStorageGet(STORAGE_KEYS.lastLocation, null);
  if (!state.currentLocation || typeof state.currentLocation !== 'object') {
    state.currentLocation = null;
  }

  state.sosActive = !!safeStorageGet(STORAGE_KEYS.sosState, false);
  state.userIdentifier = safeStorageGet(STORAGE_KEYS.userIdentifier, null);
  if (typeof state.userIdentifier !== 'string' || !state.userIdentifier) {
    state.userIdentifier = null;
  }
  state.profileName = safeStorageGet(STORAGE_KEYS.profileName, '');
  if (typeof state.profileName !== 'string') state.profileName = '';
  state.profileAge = Number(safeStorageGet(STORAGE_KEYS.profileAge, 0));
  if (!Number.isInteger(state.profileAge) || state.profileAge < 10 || state.profileAge > 120) state.profileAge = 0;
  state.profileGender = safeStorageGet(STORAGE_KEYS.profileGender, '');
  if (!['Female', 'Male', 'Other'].includes(state.profileGender)) state.profileGender = '';
  state.profileBloodGroup = safeStorageGet(STORAGE_KEYS.profileBloodGroup, '');
  if (!['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'].includes(state.profileBloodGroup)) {
    state.profileBloodGroup = '';
  }
  const savedDiseasesByMode = safeStorageGet(STORAGE_KEYS.diseasesByMode, null);
  if (savedDiseasesByMode && typeof savedDiseasesByMode === 'object' && !Array.isArray(savedDiseasesByMode)) {
    state.diseasesByMode = {
      women: sanitizeDiseaseSelections(savedDiseasesByMode.women),
      elderly: sanitizeDiseaseSelections(savedDiseasesByMode.elderly)
    };
  } else {
    const legacyDiseases = safeStorageGet(STORAGE_KEYS.preExistingDiseases, '');
    const migratedDiseases = typeof legacyDiseases === 'string' && legacyDiseases.trim()
      ? [`Other: ${legacyDiseases.trim()}`]
      : [];
    state.diseasesByMode = {
      women: [...migratedDiseases],
      elderly: [...migratedDiseases]
    };
  }
  state.profileWhatsapp = safeStorageGet(STORAGE_KEYS.profileWhatsapp, '');
  if (typeof state.profileWhatsapp !== 'string') state.profileWhatsapp = '';
  state.emergencyContactName = safeStorageGet(STORAGE_KEYS.emergencyContactName, '');
  if (typeof state.emergencyContactName !== 'string') state.emergencyContactName = '';
  state.emergencyContactWhatsapp = safeStorageGet(STORAGE_KEYS.emergencyContactWhatsapp, '');
  if (typeof state.emergencyContactWhatsapp !== 'string') state.emergencyContactWhatsapp = '';
  state.secondaryEmergencyContactName = safeStorageGet(STORAGE_KEYS.secondaryEmergencyContactName, '');
  if (typeof state.secondaryEmergencyContactName !== 'string') state.secondaryEmergencyContactName = '';
  state.secondaryEmergencyContactWhatsapp = safeStorageGet(STORAGE_KEYS.secondaryEmergencyContactWhatsapp, '');
  if (typeof state.secondaryEmergencyContactWhatsapp !== 'string') state.secondaryEmergencyContactWhatsapp = '';

  state.mode = safeStorageGet(STORAGE_KEYS.mode, null);
  if (!state.mode) {
    state.mode = 'women';
  }
  const savedProfileModes = safeStorageGet(STORAGE_KEYS.profileModes, null);
  state.profileModes = Array.isArray(savedProfileModes)
    ? [...new Set(savedProfileModes.filter((mode) => mode === 'women' || mode === 'elderly'))]
    : [state.mode];
  if (!state.profileModes.length) state.profileModes = [state.mode];
  state.theme = 'dark';
  state.fontScale = Number(safeStorageGet(STORAGE_KEYS.fontScale, 1));
  if (!Number.isFinite(state.fontScale) || state.fontScale < 1 || state.fontScale > 4) {
    state.fontScale = 1;
  }
  state.contrast = !!safeStorageGet(STORAGE_KEYS.contrast, false);
  state.voiceEnabled = safeStorageGet(STORAGE_KEYS.voice, true);
}

function persistState() {
  safeStorageSet(STORAGE_KEYS.mode, state.mode);
  safeStorageSet(STORAGE_KEYS.profileModes, state.profileModes);
  safeStorageSet(STORAGE_KEYS.theme, state.theme);
  safeStorageSet(STORAGE_KEYS.contrast, state.contrast);
  safeStorageSet(STORAGE_KEYS.fontScale, state.fontScale);
  safeStorageSet(STORAGE_KEYS.voice, state.voiceEnabled);
  safeStorageSet(STORAGE_KEYS.contacts, state.contacts);
  safeStorageSet(STORAGE_KEYS.reminders, state.reminders);
  safeStorageSet(STORAGE_KEYS.waterLogs, state.waterLogs);
  safeStorageSet(STORAGE_KEYS.safetyCheckins, state.checkins);
  safeStorageSet(STORAGE_KEYS.elderlyMood, state.moodLog);
  safeStorageSet(STORAGE_KEYS.medicineLogs, state.medicineLogs);
  safeStorageSet(STORAGE_KEYS.wellnessMedicineStatuses, state.wellnessMedicineStatuses);
  safeStorageSet(STORAGE_KEYS.lastLocation, state.currentLocation);
  safeStorageSet(STORAGE_KEYS.sosState, state.sosActive);
  safeStorageSet(STORAGE_KEYS.profileName, state.profileName);
  safeStorageSet(STORAGE_KEYS.profileAge, state.profileAge);
  safeStorageSet(STORAGE_KEYS.profileGender, state.profileGender);
  safeStorageSet(STORAGE_KEYS.profileBloodGroup, state.profileBloodGroup);
  safeStorageSet(STORAGE_KEYS.diseasesByMode, state.diseasesByMode);
  safeStorageSet(STORAGE_KEYS.profileWhatsapp, state.profileWhatsapp);
  safeStorageSet(STORAGE_KEYS.emergencyContactName, state.emergencyContactName);
  safeStorageSet(STORAGE_KEYS.emergencyContactWhatsapp, state.emergencyContactWhatsapp);
  safeStorageSet(STORAGE_KEYS.secondaryEmergencyContactName, state.secondaryEmergencyContactName);
  safeStorageSet(STORAGE_KEYS.secondaryEmergencyContactWhatsapp, state.secondaryEmergencyContactWhatsapp);
}

function sanitizeDiseaseSelections(selections) {
  if (!Array.isArray(selections)) return [];
  return [...new Set(selections.filter((disease) =>
    typeof disease === 'string'
      && (DISEASE_OPTIONS.includes(disease) || disease.startsWith('Other: '))
  ))];
}

function applyTheme() {
  state.theme = 'dark';
  document.body.dataset.theme = 'dark';
  document.body.dataset.contrast = state.contrast ? 'high' : 'normal';
  document.body.dataset.fontScale = String(state.fontScale);
  safeStorageSet(STORAGE_KEYS.theme, 'dark');
}

function applyLaunchMode(mode) {
  const launchMode = mode === 'app' ? 'app' : 'browser';
  document.body.classList.toggle('browser-mode', launchMode === 'browser');
  document.body.classList.toggle('app-mode', launchMode === 'app');
  const toggleButton = document.getElementById('appModeToggle');
  if (toggleButton) {
    toggleButton.style.display = launchMode === 'browser' && state.userIdentifier ? 'inline-flex' : 'none';
  }
  safeStorageSet(STORAGE_KEYS.launchMode, launchMode);
}

function setMode(mode, updateProfileModes = false) {
  state.mode = mode;
  if (updateProfileModes) state.profileModes = [mode];
  persistState();
  renderUserModeLabel();
  showView('home');
  renderAll();
  document.getElementById('modeModal').classList.add('hidden');
}

function showView(viewName) {
  document.querySelectorAll('.app-view').forEach((view) => {
    view.classList.toggle('active', view.id === `view-${viewName}`);
  });

  document.getElementById('userModeHeading').classList.toggle('hidden', viewName === 'home');

  document.querySelectorAll('.nav-item, .bottom-nav-item').forEach((button) => {
    const isActive = button.dataset.view === viewName;
    button.classList.toggle('active', isActive);
  });
}

function renderUserModeLabel() {
  const label = document.getElementById('userModeLabel');
  const map = {
    women: 'Women Safety Mode',
    elderly: 'Elder Care Mode'
  };
  label.textContent = map[state.mode] || 'Personal Care';
}

function getWellnessScore() {
  const currentDate = getCurrentDateKey();
  const todayWater = state.waterLogs
    .filter((entry) => entry.date === currentDate)
    .reduce((sum, entry) => sum + Number(entry.value || 0), 0);

  const sleep = Number(state.moodLog.sleep ?? 7);
  const waterScore = Math.min(100, (todayWater / 6) * 100);
  const sleepScore = Math.min(100, (sleep / 8) * 100);
  const activityScore = 72;
  const medicineStatus = getHomeMedicineStatus();
  const medicineScore = medicineStatus === 'on-track' ? 100 : medicineStatus === 'attention' ? 45 : 72;
  const total = Math.round((waterScore + sleepScore + activityScore + medicineScore) / 4);
  return { total, sleep, todayWater };
}

function getHomeMedicineStatus() {
  const status = state.wellnessMedicineStatuses[getCurrentDateKey()];
  return ['na', 'attention', 'on-track'].includes(status) ? status : 'na';
}

function getMedicineStatus() {
  const reminders = state.reminders || [];
  const today = getCurrentDateKey();
  const medicineEntries = state.medicineLogs[today] || [];
  const pending = reminders.filter((reminder) => !medicineEntries.includes(reminder.id)).length;

  if (pending === 0) {
    return { status: 'On track', summary: 'All reminders are marked as taken today.' };
  }

  return { status: 'Needs attention', summary: `${pending} reminder(s) still need attention.` };
}

function getEmergencyRecipient() {
  if (state.emergencyContactWhatsapp) {
    return {
      name: state.emergencyContactName || 'Emergency Contact',
      phone: state.emergencyContactWhatsapp
    };
  }
  return null;
}

function getEmergencyRecipients() {
  const primary = getEmergencyRecipient();
  if (!primary) return [];

  const recipients = [primary];
  if (state.secondaryEmergencyContactName && state.secondaryEmergencyContactWhatsapp) {
    recipients.push({
      name: state.secondaryEmergencyContactName,
      phone: state.secondaryEmergencyContactWhatsapp
    });
  }
  return recipients;
}

function renderHomeDashboard() {
  const score = getWellnessScore();
  const medicineStatus = getHomeMedicineStatus();
  const homeAiDecision = document.getElementById('homeAiDecision');
  const homeWellnessStatus = document.getElementById('homeWellnessStatus');
  const waterInput = document.getElementById('homeWaterInput');
  const sleepInput = document.getElementById('homeSleepInput');
  const medicineInput = document.getElementById('homeMedicineInput');
  const homeGreeting = document.getElementById('homeGreeting');
  const homeTitle = document.getElementById('homeTitle');
  const homeEmergencyContact = document.getElementById('homeEmergencyContact');
  const selectedModeLabels = state.profileModes.map((mode) =>
    mode === 'women' ? 'Women Safety' : 'Elder Care'
  );
  homeTitle.textContent = selectedModeLabels.length
    ? `Home - ${selectedModeLabels.join(' & ')}`
    : 'Home';

  const summaryText = generateWellnessAdvice({
    sleepHours: score.sleep,
    water: score.todayWater,
    mood: state.moodLog.mood || 'Good',
    medicines: medicineStatus === 'attention' ? 'Needs attention' : medicineStatus === 'on-track' ? 'On track' : 'NA'
  });

  const allMetricsGood = score.todayWater >= 3 && score.sleep >= 5 && medicineStatus !== 'attention';
  const wellnessStatus = allMetricsGood && score.total >= 70
    ? 'Good'
    : score.total >= 45 ? 'Watch' : 'Needs care';
  homeWellnessStatus.textContent = wellnessStatus;
  [waterInput, sleepInput, medicineInput].forEach((input) => {
    input.disabled = !homeWellnessEditing;
  });
  document.getElementById('editHomeWellness').hidden = homeWellnessEditing;
  document.querySelector('.home-wellness-save').hidden = !homeWellnessEditing;
  if (!homeWellnessDraftDirty) {
    waterInput.value = String(score.todayWater);
    sleepInput.value = String(score.sleep);
    medicineInput.value = medicineStatus;
  }
  homeWellnessStatus.closest('.stat-card').classList.toggle('is-good', wellnessStatus === 'Good');
  homeWellnessStatus.closest('.stat-card').classList.toggle('needs-attention', wellnessStatus !== 'Good');
  waterInput.closest('.stat-card').classList.toggle('needs-attention', score.todayWater < 3);
  sleepInput.closest('.stat-card').classList.toggle('needs-attention', score.sleep < 5);
  medicineInput.closest('.stat-card').classList.toggle('needs-attention', medicineStatus === 'attention');
  if (state.profileName && state.profileAge && state.profileGender) {
    const profileIcon = document.createElement('span');
    profileIcon.className = 'profile-summary-icon';
    profileIcon.setAttribute('aria-hidden', 'true');
    profileIcon.textContent = getProfileIcon(state.profileAge, state.profileGender);

    const profileDetails = document.createElement('span');
    profileDetails.className = 'profile-summary-details';
    profileDetails.textContent = [
      `Name: ${state.profileName} · Age: ${state.profileAge} · Gender: ${state.profileGender} · Blood Group: ${state.profileBloodGroup || 'Not set'}`,
      `Contact: ${state.profileWhatsapp || 'Not set'}`
    ].join('\n');

    homeGreeting.classList.add('profile-summary');
    homeGreeting.replaceChildren(profileIcon, profileDetails);
  } else {
    homeGreeting.classList.remove('profile-summary');
    homeGreeting.textContent = 'Add your name, age, and gender in Profile.';
  }
  const emergencyContactName = state.emergencyContactName.trim();
  const emergencyContactNumber = state.emergencyContactWhatsapp;
  const nameIsPhoneNumber = emergencyContactName.replace(/\D/g, '') === emergencyContactNumber.replace(/\D/g, '');
  const emergencyContactLabel = emergencyContactName && !nameIsPhoneNumber
    ? `${emergencyContactName} · `
    : '';
  homeEmergencyContact.textContent = emergencyContactNumber
    ? `Emergency contact: ${emergencyContactLabel}${emergencyContactNumber}`
    : 'Emergency contact: Not set';
  homeAiDecision.textContent = summaryText;
}

function populateHomeWellnessOptions() {
  const waterInput = document.getElementById('homeWaterInput');
  const sleepInput = document.getElementById('homeSleepInput');
  const today = getCurrentDateKey();
  const currentWater = state.waterLogs
    .filter((entry) => entry.date === today)
    .reduce((sum, entry) => sum + Number(entry.value || 0), 0);
  const waterOptions = [];
  const sleepOptions = [];

  for (let cups = 0; cups <= Math.max(30, currentWater); cups += 1) {
    waterOptions.push(new Option(`${cups}/6 cups`, String(cups)));
  }
  for (let hours = 0; hours <= 24; hours += 0.5) {
    sleepOptions.push(new Option(`${hours} hrs`, String(hours)));
  }

  waterInput.replaceChildren(...waterOptions);
  sleepInput.replaceChildren(...sleepOptions);
}

function saveHomeWellness(event) {
  event.preventDefault();
  if (!homeWellnessEditing) return;
  const waterInput = document.getElementById('homeWaterInput');
  const sleepInput = document.getElementById('homeSleepInput');
  const water = Number(waterInput.value);
  const sleep = Number(sleepInput.value);
  const today = getCurrentDateKey();
  const savedWater = state.waterLogs
    .filter((entry) => entry.date === today)
    .reduce((sum, entry) => sum + Number(entry.value || 0), 0);
  if (!Number.isInteger(water) || water < 0 || water > Math.max(30, savedWater)) {
    showToast(`Select water intake from 0 to ${Math.max(30, savedWater)} cups.`);
    waterInput.focus();
    return;
  }
  if (!Number.isFinite(sleep) || sleep < 0 || sleep > 24 || sleep * 2 % 1 !== 0) {
    showToast('Select sleep duration from 0 to 24 hours in half-hour increments.');
    sleepInput.focus();
    return;
  }

  state.waterLogs = state.waterLogs.filter((entry) => entry.date !== today);
  if (water > 0) state.waterLogs.push({ date: today, value: water });
  state.moodLog = { ...state.moodLog, sleep };
  state.wellnessMedicineStatuses[today] = document.getElementById('homeMedicineInput').value;
  homeWellnessDraftDirty = false;
  homeWellnessEditing = false;
  persistState();
  renderAll();
  showToast('Wellness details saved.');
}

function editHomeWellness() {
  homeWellnessEditing = true;
  homeWellnessDraftDirty = false;
  renderHomeDashboard();
  document.getElementById('homeWaterInput').focus();
}

function getProfileIcon(age, gender) {
  const icons = {
    Female: { child: '👧', young: '👩', middle: '👩‍🦳', older: '👵' },
    Male: { child: '👦', young: '👨', middle: '👨‍🦳', older: '👴' },
    Other: { child: '🧒', young: '🧑', middle: '🧑‍🦳', older: '🧓' }
  };
  const genderIcons = icons[gender] || icons.Other;
  if (age >= 60) return genderIcons.older;
  if (age >= 36) return genderIcons.middle;
  if (age >= 18) return genderIcons.young;
  return genderIcons.child;
}

function openProfileModal() {
  document.getElementById('profileName').value = state.profileName;
  document.getElementById('profileAge').value = state.profileAge || '';
  document.getElementById('profileGender').value = state.profileGender;
  document.getElementById('profileModeWomen').checked = state.profileModes.includes('women');
  document.getElementById('profileModeElderly').checked = state.profileModes.includes('elderly');
  document.getElementById('profileBloodGroup').value = state.profileBloodGroup;
  document.getElementById('profileWhatsapp').value = state.profileWhatsapp;
  document.getElementById('profileEmergencyName').value = state.emergencyContactName;
  document.getElementById('profileEmergencyWhatsapp').value = state.emergencyContactWhatsapp;
  document.getElementById('profileSecondaryEmergencyName').value = state.secondaryEmergencyContactName;
  document.getElementById('profileSecondaryEmergencyWhatsapp').value = state.secondaryEmergencyContactWhatsapp;
  document.getElementById('profileModal').classList.remove('hidden');
  document.getElementById('profileName').focus();
}

function saveProfile(event) {
  event.preventDefault();
  const profileName = document.getElementById('profileName').value.trim();
  const profileAge = Number(document.getElementById('profileAge').value);
  const profileGender = document.getElementById('profileGender').value;
  const profileModes = [...document.querySelectorAll('input[name="profileMode"]:checked')]
    .map((input) => input.value)
    .filter((mode) => mode === 'women' || mode === 'elderly');
  const profileBloodGroup = document.getElementById('profileBloodGroup').value;
  const whatsapp = document.getElementById('profileWhatsapp').value.replace(/[\s()-]/g, '');
  const emergencyContactName = document.getElementById('profileEmergencyName').value.trim();
  const emergencyContactWhatsapp = document.getElementById('profileEmergencyWhatsapp').value.replace(/[\s()-]/g, '');
  const secondaryEmergencyContactName = document.getElementById('profileSecondaryEmergencyName').value.trim();
  const secondaryEmergencyContactWhatsapp = document.getElementById('profileSecondaryEmergencyWhatsapp').value.replace(/[\s()-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(whatsapp)) {
    showToast('Enter your contact number with its country code, such as +91 98765 43210.');
    document.getElementById('profileWhatsapp').focus();
    return;
  }
  if (!profileName) {
    showToast('Enter your name.');
    document.getElementById('profileName').focus();
    return;
  }
  if (!Number.isInteger(profileAge) || profileAge < 10 || profileAge > 120) {
    showToast('Enter an age from 10 to 120.');
    document.getElementById('profileAge').focus();
    return;
  }
  if (!['Female', 'Male', 'Other'].includes(profileGender)) {
    showToast('Select a gender option.');
    document.getElementById('profileGender').focus();
    return;
  }
  if (!profileModes.length) {
    showToast('Select Women Safety, Elder Care, or both.');
    document.getElementById('profileModeWomen').focus();
    return;
  }
  if (profileBloodGroup && !['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'].includes(profileBloodGroup)) {
    showToast('Select a valid blood group.');
    document.getElementById('profileBloodGroup').focus();
    return;
  }
  if (!emergencyContactName) {
    showToast('Enter the emergency contact name.');
    document.getElementById('profileEmergencyName').focus();
    return;
  }
  if (!/^\+[1-9]\d{7,14}$/.test(emergencyContactWhatsapp)) {
    showToast('Enter the primary emergency contact number with its country code.');
    document.getElementById('profileEmergencyWhatsapp').focus();
    return;
  }
  if (secondaryEmergencyContactName && !secondaryEmergencyContactWhatsapp) {
    showToast('Enter the secondary emergency contact number or clear its name.');
    document.getElementById('profileSecondaryEmergencyWhatsapp').focus();
    return;
  }
  if (!secondaryEmergencyContactName && secondaryEmergencyContactWhatsapp) {
    showToast('Enter the secondary emergency contact name or clear its number.');
    document.getElementById('profileSecondaryEmergencyName').focus();
    return;
  }
  if (secondaryEmergencyContactWhatsapp && !/^\+[1-9]\d{7,14}$/.test(secondaryEmergencyContactWhatsapp)) {
    showToast('Enter the secondary emergency contact number with its country code.');
    document.getElementById('profileSecondaryEmergencyWhatsapp').focus();
    return;
  }
  state.profileName = profileName;
  state.profileAge = profileAge;
  state.profileGender = profileGender;
  state.profileModes = profileModes;
  if (!profileModes.includes(state.mode)) state.mode = profileModes[0];
  state.profileBloodGroup = profileBloodGroup;
  state.profileWhatsapp = whatsapp;
  state.emergencyContactName = emergencyContactName;
  state.emergencyContactWhatsapp = emergencyContactWhatsapp;
  state.secondaryEmergencyContactName = secondaryEmergencyContactName;
  state.secondaryEmergencyContactWhatsapp = secondaryEmergencyContactWhatsapp;
  persistState();
  renderAll();
  document.getElementById('profileModal').classList.add('hidden');
  showToast('Profile saved and dashboard updated.');
}

function renderHealthProfileCards() {
  const bloodGroup = state.profileBloodGroup || 'Not set';
  ['womenBloodGroup', 'elderlyBloodGroup'].forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.textContent = bloodGroup;
  });
  renderDiseaseEditor('women');
  renderDiseaseEditor('elderly');
}

function renderDiseaseEditor(mode) {
  const optionsContainer = document.querySelector(`[data-disease-options="${mode}"]`);
  const selectedContainer = document.querySelector(`[data-selected-diseases="${mode}"]`);
  if (!optionsContainer || !selectedContainer) return;

  const selectedDiseases = state.diseasesByMode[mode];
  const options = [...DISEASE_OPTIONS];
  selectedDiseases
    .filter((disease) => !options.includes(disease))
    .forEach((disease) => options.push(disease));
  optionsContainer.replaceChildren();

  options.forEach((disease) => {
    const label = document.createElement('label');
    label.className = 'disease-option';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = disease;
    checkbox.checked = selectedDiseases.includes(disease);
    checkbox.dataset.diseaseOption = '';
    label.append(checkbox, document.createTextNode(disease));
    optionsContainer.append(label);
  });

  selectedContainer.replaceChildren();
  if (!selectedDiseases.length) {
    const empty = document.createElement('p');
    empty.className = 'disease-empty';
    empty.textContent = 'No diseases selected';
    selectedContainer.append(empty);
    return;
  }

  selectedDiseases.forEach((disease) => {
    const label = document.createElement('label');
    label.className = 'selected-disease';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.value = disease;
    checkbox.dataset.removeDisease = '';
    label.append(checkbox, document.createTextNode(disease));
    selectedContainer.append(label);
  });
}

function addOtherDisease(mode) {
  const input = document.querySelector(`[data-other-disease-input="${mode}"]`);
  const disease = input?.value.trim();
  if (!disease) {
    showToast('Enter a disease name to add it.');
    input?.focus();
    return;
  }

  const diseaseLabel = `Other: ${disease}`;
  if (state.diseasesByMode[mode].includes(diseaseLabel)) {
    showToast('That disease is already selected.');
    input.focus();
    return;
  }

  state.diseasesByMode[mode].push(diseaseLabel);
  input.value = '';
  safeStorageSet(STORAGE_KEYS.diseasesByMode, state.diseasesByMode);
  renderDiseaseEditor(mode);
  showToast('Disease added to this dashboard.');
}

function handleDiseaseSelectionChange(event) {
  const checkbox = event.target.closest('[data-disease-option], [data-remove-disease]');
  if (!checkbox) return;

  const editor = checkbox.closest('[data-disease-mode]');
  const mode = editor?.dataset.diseaseMode;
  if (mode !== 'women' && mode !== 'elderly') return;

  const selectedDiseases = state.diseasesByMode[mode];
  if (checkbox.hasAttribute('data-remove-disease') || checkbox.value === 'None') {
    state.diseasesByMode[mode] = checkbox.checked
      ? ['None']
      : selectedDiseases.filter((disease) => disease !== checkbox.value);
  } else {
    const diseasesWithoutNone = selectedDiseases.filter((disease) => disease !== 'None');
    state.diseasesByMode[mode] = checkbox.checked
      ? [...new Set([...diseasesWithoutNone, checkbox.value])]
      : diseasesWithoutNone.filter((disease) => disease !== checkbox.value);
  }

  safeStorageSet(STORAGE_KEYS.diseasesByMode, state.diseasesByMode);
  renderDiseaseEditor(mode);
}

function renderWomenDashboard() {
  const womenRecommendations = document.getElementById('womenRecommendations');
  if (!womenRecommendations) return;
  const recommendations = [
    'Keep your phone charged and accessible.',
    'Share your route or location with a trusted person when travelling.',
    'Move to a public place if you feel unsafe.',
    'Use SOS if you feel immediate danger.'
  ];
  womenRecommendations.innerHTML = recommendations.map((item) => `<li>${item}</li>`).join('');
}

function renderFamilyDashboard() {

    const container = document.getElementById('familyDashboard');

    if (!container) {
        return;
    }
  const latestCheckin = state.checkins[state.checkins.length - 1];
  const lastCheckinText = latestCheckin ? new Date(latestCheckin.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No check-in yet';
  const medicineStatus = getMedicineStatus();
  const score = getWellnessScore();
  const statusText = state.sosActive ? 'Active' : 'Ready';
  const emergencyRecipient = getEmergencyRecipient();

  const cards = [
    { title: 'Elderly Check-in Status', value: latestCheckin ? latestCheckin.type : 'No data', detail: 'Latest status' },
    { title: 'Medicine Reminder Status', value: medicineStatus.status, detail: medicineStatus.summary },
    { title: 'Wellness Status', value: score.total >= 70 ? 'Stable' : 'Needs attention', detail: `Score: ${score.total}/100` },
    { title: 'Emergency Contact', value: emergencyRecipient?.name || 'None', detail: emergencyRecipient?.phone || 'No number' },
    { title: 'Last Check-in', value: lastCheckinText, detail: 'Local device time' },
    { title: 'SOS Status', value: statusText, detail: state.sosActive ? 'Emergency assistance mode activated' : 'No emergency mode active' }
  ];

  container.innerHTML = cards.map((card) => `
    <div class="family-card">
      <h3>${card.title}</h3>
      <p><strong>${card.value}</strong></p>
      <small>${card.detail}</small>
    </div>
  `).join('');
}

function renderContacts() {
    const container = document.getElementById('contactsList');

    if (!container) return;

    if (!state.emergencyContactName || !state.emergencyContactWhatsapp) {
        container.innerHTML =
            '<p>No emergency contact saved in Profile.</p>';
        return;
    }

    container.innerHTML = `
        <div class="contact-item">
            <div>
                <strong>${state.emergencyContactName}</strong>
                <small>Emergency Contact • ${state.emergencyContactWhatsapp}</small>
            </div>
        </div>
    `;
}

function renderMedicineSection() {
  const section = document.getElementById('elderlyMedicineList');
  if (!section) return;

  if (!state.reminders.length) {
    section.innerHTML = '<p>No medicine reminders saved yet.</p>';
    return;
  }

  section.innerHTML = state.reminders.map((reminder) => `
    <div class="contact-item">
      <div>
      <strong>${escapeHtml(reminder.name)}</strong>
      <small>${formatReminderTime(reminder.time)} • ${getReminderScheduleLabel(reminder)}</small>
      </div>
      <div class="contact-actions">
        <button type="button" data-reminder-action="mark" data-id="${reminder.id}">Mark as Taken</button>
        <button type="button" data-reminder-action="edit" data-id="${reminder.id}">Edit</button>
        <button type="button" data-reminder-action="delete" data-id="${reminder.id}">Delete</button>
      </div>
    </div>
  `).join('');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function normalizeReminderTime(time) {
  if (typeof time !== 'string') return '08:00';
  const twentyFourHourTime = time.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (twentyFourHourTime) {
    return `${twentyFourHourTime[1].padStart(2, '0')}:${twentyFourHourTime[2]}`;
  }
  const twelveHourTime = time.match(/^(1[0-2]|0?[1-9]):([0-5]\d)\s*(AM|PM)$/i);
  if (twelveHourTime) {
    let hours = Number(twelveHourTime[1]) % 12;
    if (twelveHourTime[3].toUpperCase() === 'PM') hours += 12;
    return `${String(hours).padStart(2, '0')}:${twelveHourTime[2]}`;
  }
  return '08:00';
}

function normalizeReminderFrequency(frequency) {
  return frequency === 'monthly' ? 'monthly' : 'weekly';
}

function normalizeReminderDays(daysOfWeek, frequency) {
  if (frequency === 'monthly') return [];
  if (Array.isArray(daysOfWeek)) {
    const validDays = [...new Set(daysOfWeek.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort();
    return validDays;
  }
  const legacyFrequency = String(frequency || '').trim().toLowerCase();
  if (legacyFrequency === 'weekdays' || legacyFrequency === 'weekdays (monday-friday)') return [1, 2, 3, 4, 5];
  return [0, 1, 2, 3, 4, 5, 6];
}

function getReminderScheduleLabel(reminder) {
  if (reminder.frequency === 'monthly') {
    return `${REMINDER_FREQUENCY_LABELS.monthly} (day ${reminder.monthDay})`;
  }
  const selectedDays = normalizeReminderDays(reminder.daysOfWeek, reminder.frequency);
  if (selectedDays.length === 7) return 'Every day';
  if (selectedDays.length === 5 && selectedDays.every((day, index) => day === index + 1)) return 'Monday–Friday';
  return selectedDays.map((day) => REMINDER_DAY_LABELS[day]).join(', ');
}

function normalizeReminderMonthDay(monthDay) {
  const day = Number(monthDay);
  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : new Date().getDate();
}

function populateMedicineMonthDays(selectedDay = new Date().getDate()) {
  const monthDaySelect = document.getElementById('medicineMonthDay');
  monthDaySelect.replaceChildren(...Array.from({ length: 31 }, (_, index) => {
    const day = index + 1;
    return new Option(String(day), String(day), false, day === selectedDay);
  }));
  updateMedicineMonthDayVisibility();
}

function updateMedicineMonthDayVisibility() {
  const isMonthly = document.getElementById('medicineFrequency').value === 'monthly';
  document.getElementById('medicineDaysField').hidden = isMonthly;
  document.getElementById('medicineMonthDayField').hidden = !isMonthly;
  document.getElementById('medicineMonthDay').required = isMonthly;
}

function formatReminderTime(time) {
  const [hours, minutes] = normalizeReminderTime(time).split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${period}`;
}

function getLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function checkMedicineReminderAlerts() {
  const now = new Date();
  const minuteOfDay = now.getHours() * 60 + now.getMinutes();
  const dateKey = getLocalDateKey(now);

  state.reminders.forEach((reminder) => {
    const [hours, minutes] = normalizeReminderTime(reminder.time).split(':').map(Number);
    if (minuteOfDay !== hours * 60 + minutes) return;
    const frequency = normalizeReminderFrequency(reminder.frequency);
    if (frequency === 'weekly' && !normalizeReminderDays(reminder.daysOfWeek, reminder.frequency).includes(now.getDay())) return;
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthlyDay = Math.min(normalizeReminderMonthDay(reminder.monthDay), lastDayOfMonth);
    if (frequency === 'monthly' && now.getDate() !== monthlyDay) return;

    const occurrenceKey = `${dateKey}:${minuteOfDay}`;
    if (reminder.lastAlertedOccurrence === occurrenceKey) return;
    reminder.lastAlertedOccurrence = occurrenceKey;
    persistState();

    const timeLabel = formatReminderTime(reminder.time);
    const message = `${reminder.name} reminder at ${timeLabel}`;
    playMedicineReminderSound(reminder);
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const notification = new Notification('Medicine reminder', { body: message });
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      } catch (error) {
        console.warn('Browser notification could not be displayed.', error);
        showToast(message);
      }
    } else {
      showToast(message);
    }
  });
}

function waitForSpeechVoices() {
  const speechSynthesis = window.speechSynthesis;
  const availableVoices = speechSynthesis.getVoices();
  if (availableVoices.length || typeof speechSynthesis.addEventListener !== 'function') {
    return Promise.resolve(availableVoices);
  }

  return new Promise((resolve) => {
    let timeoutId;
    const finish = () => {
      speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      window.clearTimeout(timeoutId);
      resolve(speechSynthesis.getVoices());
    };
    const handleVoicesChanged = () => {
      if (speechSynthesis.getVoices().length) finish();
    };
    speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
    timeoutId = window.setTimeout(finish, 2000);
  });
}

async function getProfileSpeechVoice() {
  if (!('speechSynthesis' in window)) return null;

  const voices = await waitForSpeechVoices();
  const genderPatterns = {
    Female: /\b(female|woman|zira|aria|jenny|ava|ana|samantha|karen|susan|victoria|moira|fiona|tessa|allison)\b/i,
    Male: /\b(male|man|david|mark|guy|james|daniel|alex|fred|george|tom|ryan|christopher|eric|brian|lee|ralph|rishi)\b/i
  };
  const pattern = genderPatterns[state.profileGender];
  if (!pattern) return null;

  const matchingVoices = voices.filter((voice) => pattern.test(voice.name));
  const englishVoices = matchingVoices.filter((voice) => voice.lang.toLowerCase().startsWith('en'));
  const selectedVoice = englishVoices.find((voice) => voice.lang.toLowerCase() === 'en-us') || englishVoices[0] || matchingVoices[0];
  if (!selectedVoice) {
    console.info(`No ${state.profileGender.toLowerCase()} speech voice is available; using the browser default with adjusted pitch.`);
  }
  return selectedVoice || null;
}

async function createProfileSpeechUtterance(message) {
  const utterance = new SpeechSynthesisUtterance(message);
  const voice = await getProfileSpeechVoice();
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = 'en-US';
    utterance.pitch = state.profileGender === 'Female' ? 1.2 : state.profileGender === 'Male' ? 0.85 : 1;
  }
  return utterance;
}

async function speakProfileMessage(message) {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return false;

  try {
    window.speechSynthesis.speak(await createProfileSpeechUtterance(message));
    return true;
  } catch (error) {
    console.warn('CareMate could not speak the message.', error);
    return false;
  }
}

function unlockMedicineReminderAudio() {
  if (medicineReminderAudioUnavailable) return;

  try {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) {
      medicineReminderAudioUnavailable = true;
      console.warn('Medicine reminder sound is unavailable in this browser.');
      return;
    }

    medicineReminderAudioContext ??= new AudioContextConstructor();
    if (medicineReminderAudioContext.state === 'suspended') {
      medicineReminderAudioContext.resume().catch((error) => {
        console.warn('Medicine reminder audio could not be enabled.', error);
      });
    }
  } catch (error) {
    medicineReminderAudioUnavailable = true;
    console.warn('Medicine reminder audio could not be initialized.', error);
  }
}

async function playMedicineReminderSound(reminder) {
  const playBeeps = () => playMedicineReminderBeeps(`${reminder.name} reminder at ${formatReminderTime(reminder.time)}`);
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
    playBeeps();
    return;
  }

  const timeLabel = formatReminderTime(reminder.time);
  let utterance;
  try {
    utterance = await createProfileSpeechUtterance(`Medicine reminder for ${reminder.name}. It is time to take your medicine. The scheduled time is ${timeLabel}.`);
  } catch (error) {
    console.warn('Medicine reminder voice could not be prepared.', error);
    playBeeps();
    return;
  }
  let announcementFinished = false;
  const finishAnnouncement = () => {
    if (announcementFinished) return;
    announcementFinished = true;
    clearTimeout(fallbackTimer);
    playBeeps();
  };
  const fallbackTimer = window.setTimeout(() => {
    console.warn('Medicine reminder announcement did not finish in time.');
    window.speechSynthesis.cancel();
    finishAnnouncement();
  }, 15000);
  utterance.onend = finishAnnouncement;
  utterance.onerror = (error) => {
    console.warn('Medicine reminder could not be spoken.', error);
    finishAnnouncement();
  };

  try {
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    console.warn('Medicine reminder could not be spoken.', error);
    finishAnnouncement();
  }
}

async function playMedicineReminderBeeps(message) {
  if (medicineReminderAudioUnavailable) return;

  try {
    if (!medicineReminderAudioContext) {
      const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextConstructor) throw new Error('Audio playback is not supported.');
      medicineReminderAudioContext = new AudioContextConstructor();
    }
    if (medicineReminderAudioContext.state === 'suspended') {
      await medicineReminderAudioContext.resume();
    }

    const startTime = medicineReminderAudioContext.currentTime;
    Array.from({ length: 5 }, (_, index) => index).forEach((index) => {
      const start = startTime + index * 0.55;
      const oscillator = medicineReminderAudioContext.createOscillator();
      const gain = medicineReminderAudioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = index % 2 === 0 ? 880 : 660;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.22, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
      oscillator.connect(gain);
      gain.connect(medicineReminderAudioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.31);
    });
  } catch (error) {
    console.warn('Medicine reminder sound could not be played.', error);
    showToast(`${message}. Sound could not play; check device volume and browser permissions.`);
  }
}

function renderWaterSection() {
  const water = document.getElementById('waterProgress');
  if (!water) return;
  const todayValue = state.waterLogs.filter((entry) => entry.date === getCurrentDateKey()).reduce((sum, entry) => sum + Number(entry.value || 0), 0);
  const percentage = Math.min(100, (todayValue / 6) * 100);
  water.innerHTML = `
    <div class="metric-row"><span>Today's Water</span><strong>${todayValue}/6 cups</strong></div>
    <div class="progress-bar"><span class="progress-fill" style="width:${percentage}%"></span></div>
    <div class="button-stack compact" style="margin-top: 0.8rem;">
      <button class="secondary-button" data-water="add">+ 1 Cup</button>
      <button class="secondary-button" data-water="reset">Reset</button>
    </div>
  `;
}

function renderSosPanel() {
  const container = document.getElementById('sosContainer');
  if (!container) return;

  if (!state.sosActive) {
    container.innerHTML = `
      <div class="sos-status">🚨 SOS OFF</div>
      <p>Emergency assistance mode is not active. Use it only when immediate help is needed.</p>
      <div class="button-stack compact">
        <button class="primary-button" data-action="activate-sos">Activate SOS</button>
      </div>
    `;
    return;
  }

  const emergencyMessage = createEmergencyMessage();
  const emergencyRecipient = getEmergencyRecipient();

  container.innerHTML = `
    <div class="sos-status">🚨 SOS ACTIVE</div>
    <p>Emergency assistance mode activated.</p>
    <div class="emergency-services">
      <strong>Emergency Services: 112</strong>
      <p>This is an educational demonstration and does not automatically dial emergency services.</p>
    </div>
    <div class="sos-actions">
      <button class="secondary-button" data-sos-action="call-contact">📞 Call Contact</button>
      <button class="secondary-button" data-sos-action="share-message">📤 Share Message</button>
      <button class="secondary-button" data-sos-action="get-location">📍 Update Location</button>
    </div>
    <div class="emergency-message-box">
      <label>
        Emergency Message
        <textarea id="sosMessageBox">${emergencyMessage}</textarea>
      </label>
    </div>
    <div class="emergency-services">
      <strong>Primary Emergency Contact</strong>
      <p>${emergencyRecipient ? `${emergencyRecipient.name} • ${emergencyRecipient.phone}` : 'No emergency contact saved.'}</p>
      ${state.secondaryEmergencyContactWhatsapp ? `<p>Secondary: ${state.secondaryEmergencyContactName} • ${state.secondaryEmergencyContactWhatsapp}</p>` : ''}
      ${state.currentLocation ? `<p>Location: ${state.currentLocation.latitude.toFixed(4)}, ${state.currentLocation.longitude.toFixed(4)} (${state.currentLocation.accuracy} m)</p>` : '<p>Location: Permission not yet granted.</p>'}
    </div>
  `;
}

function formatLocationForMessage(location) {
  const latitude = Number(location.latitude).toFixed(6);
  const longitude = Number(location.longitude).toFixed(6);
  return `Current location: ${latitude}, ${longitude}\nMap: https://maps.google.com/?q=${latitude},${longitude}`;
}

function ensureEmergencyIcon(message) {
  const trimmedMessage = message.trim();
  if (trimmedMessage.includes('🆘') || trimmedMessage.includes('🚨')) return trimmedMessage;
  return `🆘 EMERGENCY ASSISTANCE\n${trimmedMessage}`;
}

function removeLocationDetails(message) {
  return ensureEmergencyIcon(message)
    .split(/\r?\n/)
    .filter((line) => !/^(?:my )?current location:|^map:/i.test(line.trim()))
    .join('\n')
    .trim();
}

function includeLocationInMessage(message, location) {
  return [removeLocationDetails(message), formatLocationForMessage(location)].filter(Boolean).join('\n');
}

function includeUnavailableLocationInMessage(message) {
  return [removeLocationDetails(message), 'Current location: unavailable.'].filter(Boolean).join('\n');
}

function createEmergencyMessage() {
  const recipients = getEmergencyRecipients();
  const contactDetails = recipients.map((recipient) => `${recipient.name} (${recipient.phone})`).join(' and ')
    || 'trusted contact';
  const locationText = state.currentLocation
    ? formatLocationForMessage(state.currentLocation)
    : 'Current location: unavailable.';

  const message = [
    '🆘 EMERGENCY: I need emergency assistance. Please contact me immediately.',
    locationText,
    `Please contact my emergency contact(s): ${contactDetails}.`
  ].join('\n');
  state.lastEmergencyMessage = message;
  return message;
}

function openEmergencyWhatsApp(popup, message, recipient = getEmergencyRecipient()) {
  if (!recipient?.phone) {
    popup?.close();
    showToast('Add a primary emergency contact number in Profile first.');
    return false;
  }
  if (!popup || popup.closed) {
    showToast('WhatsApp could not open. Allow pop-ups and activate SOS again.');
    return false;
  }

  const phoneDigits = recipient.phone.replace(/\D/g, '');
  popup.opener = null;
  popup.location.href = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
  return true;
}

function openEmergencyWhatsAppDrafts(recipients, message, reservedPopups = null) {
  const popups = reservedPopups || [];
  if (!reservedPopups) {
    for (const recipient of recipients) {
      const popup = window.open('about:blank', '_blank');
      if (!popup) {
        popups.forEach((openedPopup) => openedPopup.close());
        showToast('Allow pop-ups to prepare WhatsApp messages for all saved emergency contacts.');
        return false;
      }
      popups.push(popup);
    }
  }

  if (popups.length !== recipients.length) {
    popups.forEach((popup) => {
      if (!popup.closed) popup.close();
    });
    showToast('Unable to prepare WhatsApp messages for both emergency contacts.');
    return false;
  }

  const opened = recipients.every((recipient, index) =>
    openEmergencyWhatsApp(popups[index], message, recipient)
  );
  if (!opened) {
    popups.forEach((popup) => {
      if (!popup.closed) popup.close();
    });
    return false;
  }
  return true;
}

function openWhatsAppWithLocation(messageFactory, preparingMessage) {
  const recipients = getEmergencyRecipients();
  if (!recipients.length) {
    showToast('Add a primary emergency contact name and number in Profile first.');
    openProfileModal();
    return false;
  }

  const popups = [];
  for (const recipient of recipients) {
    const popup = window.open('about:blank', '_blank');
    if (!popup) {
      popups.forEach((openedPopup) => openedPopup.close());
      showToast('Allow pop-ups to prepare WhatsApp messages for both emergency contacts.');
      return false;
    }
    popups.push(popup);
  }

  const openWithCurrentMessage = (locationAvailable) => {
    const message = messageFactory(state.currentLocation, locationAvailable);
    const messageBox = document.getElementById('sosMessageBox');
    if (messageBox) messageBox.value = message;

    if (openEmergencyWhatsAppDrafts(recipients, message, popups)) {
      showToast(locationAvailable
        ? 'WhatsApp drafts are ready for all saved emergency contacts. Tap Send in each chat.'
        : 'Location is unavailable. WhatsApp drafts are ready for all saved contacts; tap Send in each chat.');
    }
  };

  if (state.currentLocation) {
    openWithCurrentMessage(true);
    return;
  }

  try {
    popups.forEach((popup) => {
      popup.document.title = 'Preparing SOS message';
      popup.document.body.textContent = 'Getting your current location for the emergency message...';
    });
  } catch (error) {
    // The browser may restrict access to the new tab before navigation.
  }
  showToast(preparingMessage);
  requestLocation(
    () => openWithCurrentMessage(true),
    () => openWithCurrentMessage(false)
  );
  return true;
}

function openWhatsAppForEmergencyContactsWithLocation(messageFactory, preparingMessage) {
  return openWhatsAppWithLocation(messageFactory, preparingMessage);
}

function startEmergencyWhatsAppFlow() {
  return openWhatsAppWithLocation(
    () => createEmergencyMessage(),
    'SOS activated. Getting your current location...'
  );
}

function startSosCall() {
  const primaryContact = getEmergencyRecipient();
  if (!primaryContact) {
    showToast('Add a primary emergency contact name and number in Profile first.');
    openProfileModal();
    return;
  }

  window.location.href = `tel:${primaryContact.phone}`;
}

function generateWellnessAdvice({ sleepHours, water, mood, medicines }) {
  const warnings = [];

  if (sleepHours < 5) {
    warnings.push('Your sleep duration is low. Consider maintaining a regular sleep schedule.');
  }

  if (water < 3) {
    warnings.push('Remember to drink enough water.');
  }

  if (mood === 'Not Well' || mood === 'Need Help') {
    warnings.push('Consider talking to a family member or healthcare professional.');
  }

  if (medicines === 'Needs attention') {
    warnings.push('Your medicine schedule needs attention. Please review your reminder list.');
  }

  if (!warnings.length) {
    return 'Your indicators look stable. Continue healthy habits and keep checking in.';
  }

  return warnings.join(' ');
}

function handleSymptomGuidance(symptom) {
  const result = document.getElementById('aiRecommendation');
  if (!result) return;
  const illustration = document.getElementById('conditionIllustration');

  if (!symptom) {
    illustration.hidden = true;
    illustration.removeAttribute('src');
    illustration.alt = '';
    result.textContent = 'Select a condition to view recommendation.';
    result.removeAttribute('style');
    return;
  }

  const illustrations = {
    'Headache': './assets/conditions/headache.svg',
    'Dizziness': './assets/conditions/dizziness.svg',
    'Fatigue': './assets/conditions/fatigue.svg',
    'Fever': './assets/conditions/fever.svg',
    'Weakness': './assets/conditions/weakness.svg',
    'Breathing difficulty': './assets/conditions/breathing-difficulty.svg',
    'Chest discomfort': './assets/conditions/chest-discomfort.svg',
    'Menstrual Pain': './assets/conditions/menstrual-pain.svg',
    'Pregnancy Care': './assets/conditions/pregnancy-care.svg',
    'Menopause': './assets/conditions/menopause.svg',
    'Anemia': './assets/conditions/anemia.svg',
    'Joint Pain': './assets/conditions/joint-pain.svg',
    'Diabetes': './assets/conditions/diabetes.svg',
    'Memory Concerns': './assets/conditions/memory-concerns.svg',
    'Blood Pressure': './assets/conditions/blood-pressure.svg'
  };
  const illustrationPath = illustrations[symptom];
  if (illustrationPath) {
    illustration.src = illustrationPath;
    illustration.alt = `${symptom} illustration`;
    illustration.hidden = false;
  } else {
    illustration.hidden = true;
    illustration.removeAttribute('src');
    illustration.alt = '';
  }

  const guidance = {

    "Headache":
        "🧠 Drink plenty of water, rest in a quiet place, reduce screen time, and ensure adequate sleep.",

    "Dizziness":
        "💫 Sit or lie down immediately, drink water, avoid sudden movements, and seek medical help if symptoms persist.",

    "Fatigue":
        "😴 Get sufficient rest, eat nutritious meals, stay hydrated, and avoid overexertion.",

    "Fever":
        "🌡️ Drink fluids, take adequate rest, monitor temperature, and consult a doctor if fever remains high.",

    "Weakness":
        "💪 Maintain hydration, eat balanced meals, and seek medical advice if weakness continues.",

    "Breathing difficulty":
        "🚨 Sit upright, remain calm, loosen tight clothing, and seek immediate medical attention.",

    "Chest discomfort":
        "🚨 Stop physical activity immediately and seek emergency medical care if symptoms continue.",

    "Menstrual Pain":
        "🌸 Use a heating pad, stay hydrated, rest, and consider light exercise. Consult a doctor if pain is severe.",

    "Pregnancy Care":
        "🤰 Attend prenatal checkups, eat nutritious food, take prescribed supplements, stay hydrated, and get adequate rest.",

    "Menopause":
        "🌷 Maintain a healthy diet, exercise regularly, manage stress, and discuss persistent symptoms with a healthcare provider.",

    "Anemia":
        "🥬 Increase iron-rich foods such as spinach, dates, beans, and leafy vegetables. Follow medical advice regarding supplements.",

    "Joint Pain":
        "🦴 Gentle stretching, regular exercise, maintaining a healthy weight, and proper posture may help reduce discomfort.",

    "Diabetes":
        "🩸 Monitor blood sugar regularly, follow a balanced diet, exercise consistently, and take medicines as prescribed.",

    "Memory Concerns":
        "🧠 Stay mentally active through reading, puzzles, social interaction, regular exercise, and medical consultation when needed.",

    "Blood Pressure":
        "❤️ Monitor blood pressure regularly, reduce salt intake, exercise moderately, manage stress, and take prescribed medications.",

    "Other":
        "📋 Monitor symptoms carefully, stay hydrated, get enough rest, and consult a healthcare professional if symptoms worsen."
};

  result.textContent =
    guidance[symptom] ||
    "Monitor symptoms carefully and seek medical advice if symptoms worsen.";

  // Emergency symptoms highlighted in RED
  if (
    symptom === "Breathing difficulty" ||
    symptom === "Chest discomfort"
  ) {
    result.style.color = "#ff4d4d";
    result.style.background = "rgba(255,77,77,0.15)";
    result.style.border = "1px solid #ff4d4d";
    result.style.fontWeight = "700";
  }
  else {
    result.style.color = "#4ade80";
    result.style.background = "rgba(74,222,128,0.12)";
    result.style.border = "1px solid #4ade80";
    result.style.fontWeight = "600";
  }
}

function openConditionPicker(picker, focusLast = false) {
  const trigger = picker.querySelector('#conditionPickerTrigger');
  const menu = picker.querySelector('#conditionPickerOptions');
  const options = Array.from(picker.querySelectorAll('[role="option"]'));
  const selectedIndex = options.findIndex((option) => option.getAttribute('aria-selected') === 'true');
  const targetIndex = focusLast ? options.length - 1 : Math.max(0, selectedIndex);

  menu.hidden = false;
  trigger.setAttribute('aria-expanded', 'true');
  options.forEach((option, index) => {
    option.tabIndex = index === targetIndex ? 0 : -1;
  });
  options[targetIndex].focus();
}

function closeConditionPicker(picker) {
  picker.querySelector('#conditionPickerOptions').hidden = true;
  picker.querySelector('#conditionPickerTrigger').setAttribute('aria-expanded', 'false');
}

function chooseCondition(option) {
  const picker = option.closest('#conditionPicker');
  const value = option.dataset.condition;

  picker.querySelectorAll('[role="option"]').forEach((item) => {
    item.setAttribute('aria-selected', String(item === option));
    item.tabIndex = item === option ? 0 : -1;
  });
  picker.querySelector('#conditionPickerValue').textContent = option.textContent;
  closeConditionPicker(picker);
  handleSymptomGuidance(value);
  picker.querySelector('#conditionPickerTrigger').focus();
}

function processSafetyCheckin(type) {
  const checkinBox = document.getElementById('checkinResult');
  const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const lookup = {
    safe: 'Safety check-in completed at ' + timeString + '.',
    unsafe: 'Move to a safe public location, contact a trusted person, and use SOS if immediate assistance is required.',
    help: 'Please contact a trusted family member or caregiver immediately. Use SOS if immediate help is required.'
  };

  const checkinType = type === 'safe' ? 'Safe' : type === 'unsafe' ? 'Unsafe' : 'Need Help';
  state.checkins.push({ time: Date.now(), type: checkinType, choice: type, message: lookup[type] });
  updateSafetyCheckinSelection(type);

  persistState();
  renderFamilyDashboard();
  checkinBox.textContent = lookup[type] || 'Safety check-in recorded.';
  showToast('Safety check-in saved locally.');
  if (type === 'unsafe' || type === 'help') {
    if (openCheckinWhatsApp(type)) {
      checkinBox.textContent += ' A WhatsApp message is prepared; tap Send in WhatsApp.';
    } else if (!getEmergencyRecipient()) {
      checkinBox.textContent += ' Add an emergency contact name and number in Profile to prepare a message.';
    }
  }
}

function updateSafetyCheckinSelection(selectedType) {
  document.querySelectorAll('[data-checkin]').forEach((button) => {
    const selected = button.dataset.checkin === selectedType;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}

function renderSafetyCheckinState() {
  const latest = state.checkins[state.checkins.length - 1];
  if (!latest) return;

  const type = latest.choice || ({ Safe: 'safe', Unsafe: 'unsafe', 'Need Help': 'help' })[latest.type];
  if (type) updateSafetyCheckinSelection(type);
  const result = document.getElementById('checkinResult');
  if (result) {
    result.textContent = latest.message || `Last check-in: ${latest.type} at ${new Date(latest.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
  }
}

function openCheckinWhatsApp(type) {
  const checkinText = type === 'help'
    ? '🆘 I need help now. Please contact me immediately.'
    : '🆘 I feel unsafe. Please contact me as soon as possible.';
  return openWhatsAppWithLocation(
    (location) => `${checkinText}\n${location ? formatLocationForMessage(location) : 'Current location: unavailable.'}`,
    'Getting your location for the check-in message...'
  );
}

function requestLocation(onSuccess = null, onError = null) {
  const messageDraft = document.getElementById('sosMessageBox')?.value || '';
  const defaultMessage = createEmergencyMessage();
  const hasCustomMessage = messageDraft && messageDraft !== defaultMessage;

  if (!navigator.geolocation) {
    const message = 'Location services are not supported on this browser.';
    showToast(message);
    if (onError) onError(message);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: Math.round(position.coords.accuracy || 0)
      };
      state.currentLocation = location;
      persistState();
      renderSosPanel();
      const updatedMessage = document.getElementById('sosMessageBox');
      if (hasCustomMessage && updatedMessage) {
        updatedMessage.value = includeLocationInMessage(messageDraft, location);
        state.lastEmergencyMessage = updatedMessage.value;
      }
      if (onSuccess) {
        onSuccess(location);
      } else {
        showToast('Location saved locally.');
      }
    },
    (error) => {
      let message = 'Location permission was not granted. We cannot get your location right now.';
      if (error.code === 1) message = 'Location permission was denied. You can still use SOS and emergency messages without sharing your location.';
      if (error.code === 2) message = 'Location is currently unavailable. Please try again later.';
      showToast(message);
      if (onError) onError(message);
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function renderLocationShareStatus(message = '') {
  const status = document.getElementById('locationShareStatus');
  const mapLink = document.getElementById('locationMapLink');
  if (!status || !mapLink) return;

  if (!state.currentLocation) {
    status.textContent = message || 'Location is not available yet. Choose an app to request it.';
    mapLink.classList.add('hidden');
    return;
  }

  const { latitude, longitude, accuracy } = state.currentLocation;
  status.textContent = message || `Location ready (${accuracy} m accuracy).`;
  mapLink.href = `https://maps.google.com/?q=${latitude},${longitude}`;
  mapLink.classList.remove('hidden');
}

function setLocationShareButtonsDisabled(disabled) {
  document.querySelectorAll('[data-location-share-target]').forEach((button) => {
    button.disabled = disabled;
  });
}

function openLocationShareModal() {
  renderLocationShareStatus();
  document.getElementById('locationShareModal').classList.remove('hidden');
}

function shareLocationWith(target) {
  const serviceName = target === 'whatsapp' ? 'WhatsApp' : 'Messenger';
  if (!state.currentLocation) {
    setLocationShareButtonsDisabled(true);
    renderLocationShareStatus('Getting your current location...');
    requestLocation(
      () => {
        setLocationShareButtonsDisabled(false);
        renderLocationShareStatus(`Location saved. Tap ${serviceName} again to share it.`);
      },
      (message) => {
        setLocationShareButtonsDisabled(false);
        renderLocationShareStatus(message);
      }
    );
    return;
  }

  const message = `🆘 Emergency location\n${formatLocationForMessage(state.currentLocation)}`;
  if (target === 'whatsapp') {
    openWhatsAppWithLocation(() => message, 'Preparing your emergency location message...');
    return;
  }

  if (navigator.share) {
    navigator.share({ title: 'CareMate Emergency Location', text: message })
      .then(() => showToast('Location shared.'))
      .catch((error) => {
        if (error.name !== 'AbortError') showToast('Unable to share the location.');
      });
    return;
  }

  if (navigator.clipboard) {
    navigator.clipboard.writeText(message).then(() => {
      window.open('https://www.messenger.com/', '_blank', 'noopener,noreferrer');
      showToast('Location copied. Paste it into a Messenger chat.');
    }).catch(() => showToast('Unable to copy the location for Messenger.'));
    return;
  }

  showToast('Messenger sharing is not supported on this browser. Use the map link to share your location.');
}

function addMedicineReminder(payload) {
  const reminderName = payload.name.trim();
  const reminderTime = normalizeReminderTime(payload.time);
  const reminderFrequency = normalizeReminderFrequency(payload.frequency);
  const daysOfWeek = normalizeReminderDays(payload.daysOfWeek, payload.frequency);
  const monthDay = normalizeReminderMonthDay(payload.monthDay);

  if (!reminderName || !/^\d{2}:\d{2}$/.test(reminderTime)) {
    showToast('Please fill in all medicine reminder fields.');
    return false;
  }
  if (reminderFrequency === 'weekly' && !daysOfWeek.length) {
    showToast('Select at least one day of the week.');
    return false;
  }

  const reminder = {
    id: payload.id || `m${Date.now()}`,
    name: reminderName,
    time: reminderTime,
    frequency: reminderFrequency,
    daysOfWeek,
    monthDay,
    lastAlertedOccurrence: payload.id
      ? state.reminders.find((item) => item.id === payload.id)?.lastAlertedOccurrence
      : ''
  };

  if (payload.id) {
    state.reminders = state.reminders.map((item) => item.id === payload.id ? reminder : item);
  } else {
    state.reminders.push(reminder);
  }

  persistState();
  renderMedicineSection();
  renderHomeDashboard();
  renderFamilyDashboard();
  showToast('Medicine reminder saved.');
  return true;
}

function handleMedicineAction(action, id) {
  if (action === 'delete') {
    state.reminders = state.reminders.filter((item) => item.id !== id);
    persistState();
    renderMedicineSection();
    renderHomeDashboard();
    renderFamilyDashboard();
    showToast('Reminder deleted.');
    return;
  }

  if (action === 'mark') {
    const today = getCurrentDateKey();
    const log = state.medicineLogs[today] || [];
    if (!log.includes(id)) {
      state.medicineLogs[today] = [...log, id];
      persistState();
      renderHomeDashboard();
      renderFamilyDashboard();
      renderMedicineSection();
      showToast('Medicine marked as taken.');
    }
    return;
  }

  if (action === 'edit') {
    const reminder = state.reminders.find((item) => item.id === id);
    if (!reminder) return;
    document.getElementById('medicineName').value = reminder.name;
    document.getElementById('medicineTime').value = reminder.time;
    document.getElementById('medicineFrequency').value = reminder.frequency;
    document.querySelectorAll('input[name="medicineDays"]').forEach((checkbox) => {
      checkbox.checked = reminder.daysOfWeek.includes(Number(checkbox.value));
    });
    populateMedicineMonthDays(reminder.monthDay);
    updateMedicineMonthDayVisibility();
    document.getElementById('medicineForm').dataset.editId = reminder.id;
    showToast('Reminder is ready to edit.');
  }
}

function handleWaterAction(action) {
  const today = getCurrentDateKey();
  const total = state.waterLogs.filter((item) => item.date === today).reduce((sum, entry) => sum + Number(entry.value || 0), 0);

  if (action === 'add') {
    state.waterLogs.push({ date: today, value: 1 });
    persistState();
    renderWaterSection();
    renderHomeDashboard();
    showToast(`Water updated to ${total + 1} cups.`);
    return;
  }

  state.waterLogs = state.waterLogs.filter((entry) => entry.date !== today);
  persistState();
  renderWaterSection();
  renderHomeDashboard();
  showToast('Water log reset for today.');
}

function handleVoiceInput() {
  if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
    showToast('Voice assistance is not supported by this browser. Please use the buttons.');
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.start();

  recognition.onresult = (event) => {
    const spoken = event.results[0][0].transcript.toLowerCase();
    handleVoiceCommand(spoken);
  };

  recognition.onerror = () => {
    showToast('Voice command was not recognized. Please try again.');
  };
}

function handleVoiceCommand(command) {
  const normalized = command.trim().toLowerCase().replace(/[.!?,]/g, '').replace(/\s+/g, ' ');
  const views = {
    'open sos': 'sos',
    'open health': 'elderly',
    'open medicine': 'elderly',
    'open elderly care': 'elderly',
    'open women safety': 'women',
    'open ai assistant': 'assistant',
    'open home': 'home',
    'open contacts': 'contacts'
  };

  if (views[normalized]) {
    showView(views[normalized]);
    const message = `Opening ${views[normalized]}.`;
    showToast(message);
    speakProfileMessage(message);
    return;
  }

  if (
    normalized.includes('call emergency') ||
    normalized.includes('call emergence') ||
    normalized.includes('call my emergency contact')
  ) {
    const emergencyContact = getEmergencyRecipient() || state.contacts[0];
    if (emergencyContact) {
      speakEmergencyFeedback('Calling emergency contact', () => {
        window.location.href = `tel:${emergencyContact.phone}`;
      });
    } else {
      showToast('No emergency contact is saved yet.');
      speakProfileMessage('No emergency contact is saved yet.');
    }
    return;
  }

  const messageCommands = [
    'message emergency',
    'message emergence',
    'message emergency contact',
    'message emergence contact',
    'send message',
    'send a message',
    'send message to emergency',
    'send message to emergence',
    'send message to emergency contact',
    'send emergency message'
  ];
  if (messageCommands.includes(normalized)) {
    const recipient = getEmergencyRecipient();
    if (!recipient?.phone) {
      showToast('Add an emergency contact name and number in Profile first.');
      speakProfileMessage('Add an emergency contact name and number in Profile first.');
      openProfileModal();
      return;
    }

    speakEmergencyFeedback('Sending message to emergency contact', () => {
      showView('sos');
      renderSosPanel();
      openWhatsAppForEmergencyContactsWithLocation(
        (location, locationAvailable) => locationAvailable
          ? createEmergencyMessage()
          : includeUnavailableLocationInMessage(createEmergencyMessage()),
        'Getting your location for the emergency message...'
      );
    });
    return;
  }

  const message = 'Voice command not recognized. Try: open SOS or open AI assistant.';
  showToast(message);
  speakProfileMessage(message);
}

async function speakEmergencyFeedback(message, onComplete) {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
    onComplete();
    return;
  }

  let completed = false;
  const complete = () => {
    if (completed) return;
    completed = true;
    onComplete();
  };
  let utterance;
  try {
    utterance = await createProfileSpeechUtterance(message);
  } catch (error) {
    console.error('Unable to prepare emergency voice feedback.', error);
    complete();
    return;
  }
  utterance.onend = complete;
  utterance.onerror = complete;

  try {
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    console.error('Unable to play emergency voice feedback.', error);
    complete();
  }
}

function clearUserData() {
  const confirmed = window.confirm('This will clear local app data including contacts and settings. Continue?');
  if (!confirmed) return;

  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('aiCare')) {
      localStorage.removeItem(key);
    }
  });

  ensureDemoData();
  applyTheme();
  renderAll();
  showToast('Your local data has been cleared.');
}

function renderAll() {
  renderUserModeLabel();
  applyTheme();
  renderHomeDashboard();
  renderHealthProfileCards();
  renderWomenDashboard();
  renderFamilyDashboard();
  renderContacts();
  renderMedicineSection();
  renderWaterSection();
  renderSosPanel();
  renderSettingOptions();
  renderAboutPage();
  renderSafetyCheckinState();
  document.body.dataset.theme = state.theme;
  document.body.dataset.contrast = state.contrast ? 'high' : 'normal';
  document.body.dataset.fontScale = String(state.fontScale);
  const checkinResult = document.getElementById('checkinResult');
  if (checkinResult) checkinResult.textContent = checkinResult.textContent || 'No check-in yet.';
}

function renderSettingOptions() {
  const voiceToggle = document.querySelector('[data-voice-toggle="toggle"]');
  if (voiceToggle) {
    voiceToggle.textContent = state.voiceEnabled ? '🎤 Voice Assistance On' : '🎤 Voice Assistance Off';
  }
  const signedInIdentifier = document.getElementById('signedInIdentifier');
  if (signedInIdentifier) signedInIdentifier.textContent = state.userIdentifier || '';
}

function renderAboutPage() {
  const aboutSection = document.getElementById('view-about');
  if (!aboutSection) return;

  aboutSection.innerHTML = `
    <div class="section-header">
      <div>
        <p class="eyebrow accent">About</p>
        <h2>AI Care+ Project</h2>
      </div>
    </div>

    <div class="card-grid two-col">
      <div class="info-card">
        <h3>Project</h3>
        <p><strong>AI Care+</strong> is a CBSE Class 10 Artificial Intelligence project designed to show how AI can help women and elderly people in daily life.</p>
      </div>
      <div class="info-card">
        <h3>Purpose</h3>
        <p>The project demonstrates how smart rules, pattern recognition and recommendations can support safety, wellness and emergency awareness.</p>
      </div>
      <div class="info-card">
        <h3>Technology</h3>
        <ul class="simple-list">
          <li>HTML5</li>
          <li>CSS3</li>
          <li>JavaScript</li>
          <li>PWA</li>
          <li>Browser APIs</li>
        </ul>
      </div>
      <div class="info-card">
        <h3>Techniques</h3>
        <ul class="simple-list">
          <li>Rule-based decision support</li>
          <li>Pattern recognition</li>
          <li>Recommendation logic</li>
        </ul>
      </div>
      <div class="info-card full-span">
        <h3>How It Works</h3>
        <p><strong>What is AI?</strong> AI means making machines follow patterns and make simple decisions based on data.</p>
        <p><strong>How AI can help women?</strong> It can provide quick safety suggestions, emergency support, and location-based guidance.</p>
        <p><strong>How AI can help elderly people?</strong> It can remind them about medicine, hydration, health check-ins and family contact.</p>
        <p><strong>How AI identifies patterns?</strong> It checks inputs such as sleep, mood, water and symptoms to notice patterns.</p>
        <p><strong>How AI makes recommendations?</strong> It applies rules and shows suggestions that are easy to understand.</p>
        <p><strong>What are AI limitations?</strong> AI is educational and cannot replace emergency services, doctors or caregivers.</p>
        <p><strong>Why human judgement is important?</strong> People should use their own decision-making with AI support.</p>
        <p><strong>What is responsible AI?</strong> It means using AI carefully, privately and safely.</p>
      </div>
      <div class="info-card full-span">
        <h3>Decision Flow</h3>
        <div class="result-box">
          USER INPUT → DATA COLLECTION → DATA ANALYSIS → PATTERN IDENTIFICATION → AI DECISION → RECOMMENDATION → USER ACTION
        </div>
      </div>
    </div>
  `;
}

function initializeApp() {
  ensureDemoData();
  populateHomeWellnessOptions();
  populateMedicineMonthDays();
  applyTheme();
  renderAll();
  checkMedicineReminderAlerts();
  window.setInterval(checkMedicineReminderAlerts, 15000);

  document.body.addEventListener('click', (event) => {
    unlockMedicineReminderAudio();
    const picker = document.getElementById('conditionPicker');
    const conditionTrigger = event.target.closest('#conditionPickerTrigger');
    const conditionOption = event.target.closest('[role="option"]');

    if (picker && !picker.contains(event.target)) {
      closeConditionPicker(picker);
    }

    if (conditionTrigger) {
      if (conditionTrigger.getAttribute('aria-expanded') === 'true') {
        closeConditionPicker(picker);
      } else {
        openConditionPicker(picker);
      }
      return;
    }

    if (conditionOption) {
      chooseCondition(conditionOption);
      return;
    }

    const profileOpenButton = event.target.closest('[data-action="profile-open"]');
    if (profileOpenButton) {
      openProfileModal();
      return;
    }

    const profileAction = event.target.closest('[data-profile-action]');
    if (profileAction) {
      document.getElementById('profileModal').classList.add('hidden');
      return;
    }

    if (event.target.id === 'profileModal') {
      event.target.classList.add('hidden');
      return;
    }

    const sosCallButton = event.target.closest('[data-action="sos-call-primary"]');
    if (sosCallButton) {
      startSosCall();
      return;
    }

    const button = event.target.closest('[data-view]');
    if (button) {
      if (button.dataset.view === 'women' || button.dataset.view === 'elderly') {
        setMode(button.dataset.view);
      }

      showView(button.dataset.view);
      return;
    }

    const locationShareTarget = event.target.closest('[data-location-share-target]');
    if (locationShareTarget) {
      shareLocationWith(locationShareTarget.dataset.locationShareTarget);
      return;
    }

    const locationShareAction = event.target.closest('[data-location-share-action]');
    if (locationShareAction) {
      const action = locationShareAction.dataset.locationShareAction;
      if (action === 'close') {
        document.getElementById('locationShareModal').classList.add('hidden');
      } else if (action === 'refresh') {
        setLocationShareButtonsDisabled(true);
        renderLocationShareStatus('Updating your location...');
        requestLocation(
          () => {
            setLocationShareButtonsDisabled(false);
            renderLocationShareStatus('Location updated. Choose an app to share it.');
          },
          (message) => {
            setLocationShareButtonsDisabled(false);
            renderLocationShareStatus(message);
          }
        );
      }
      return;
    }

    if (event.target.id === 'locationShareModal') {
      event.target.classList.add('hidden');
      return;
    }

    const voiceToggleButton = event.target.closest('[data-voice-toggle]');
    if (voiceToggleButton) {
      state.voiceEnabled = !state.voiceEnabled;
      persistState();
      renderSettingOptions();
      showToast(state.voiceEnabled ? 'Voice assistance enabled.' : 'Voice assistance disabled.');
      return;
    }

    const fontButton = event.target.closest('[data-font-action]');
    if (fontButton) {
      const action = fontButton.dataset.fontAction;
      if (action === 'increase') state.fontScale = Math.min(4, state.fontScale + 1);
      if (action === 'decrease') state.fontScale = Math.max(1, state.fontScale - 1);
      persistState();
      applyTheme();
      showToast(`Font scale set to ${state.fontScale}.`);
      return;
    }

    const contrastButton = event.target.closest('[data-contrast="toggle"]');
    if (contrastButton) {
      state.contrast = !state.contrast;
      persistState();
      applyTheme();
      showToast(state.contrast ? 'High contrast enabled.' : 'High contrast disabled.');
      return;
    }

    const accessibilityButton = event.target.closest('[data-accessibility]');
    if (accessibilityButton) {
      document.body.classList.toggle('large-buttons');
      showToast('Large button styling enabled.');
      return;
    }

    const dataModeButton = event.target.closest('[data-profile-mode]');
    if (dataModeButton) {
      setMode(dataModeButton.dataset.profileMode, dataModeButton.closest('#modeModal') !== null);
      return;
    }

    const checkinButton = event.target.closest('[data-checkin]');
    if (checkinButton) {
      processSafetyCheckin(checkinButton.dataset.checkin);
      return;
    }

    const reminderAction = event.target.closest('[data-reminder-action]');
    if (reminderAction) {
      handleMedicineAction(reminderAction.dataset.reminderAction, reminderAction.dataset.id);
      return;
    }

    const waterAction = event.target.closest('[data-water]');
    if (waterAction) {
      handleWaterAction(waterAction.dataset.water);
      return;
    }

    const sosAction = event.target.closest('[data-sos-action]');
    if (sosAction) {
      const action = sosAction.dataset.sosAction;
      if (action === 'call-contact') {
        const emergencyContact = getEmergencyRecipient();
        if (emergencyContact) {
          window.location.href = `tel:${emergencyContact.phone}`;
        } else {
          showToast('No emergency contact has been saved.');
        }
      }
      if (action === 'share-message') {
        const messageBox = document.getElementById('sosMessageBox');
        const draft = messageBox?.value || createEmergencyMessage();
        openWhatsAppWithLocation(
          (location) => location
            ? includeLocationInMessage(draft, location)
            : includeUnavailableLocationInMessage(draft),
          'Getting your location for the emergency message...'
        );
      }
      if (action === 'get-location') {
        requestLocation();
      }
      return;
    }

    const confirmAction = event.target.closest('[data-confirm-action]');
    if (confirmAction) {
      const action = confirmAction.dataset.confirmAction;
      if (action === 'cancel') {
        document.getElementById('confirmationModal').classList.add('hidden');
        return;
      }
      if (action === 'activate-sos') {
        state.sosActive = true;
        persistState();
        document.getElementById('confirmationModal').classList.add('hidden');
        renderSosPanel();
        startEmergencyWhatsAppFlow();
      }
      return;
    }

    const activateSos = event.target.closest('[data-action="activate-sos"]');
    if (activateSos) {
      document.getElementById('confirmationModal').classList.remove('hidden');
      return;
    }

    const openLocation = event.target.closest('[data-action="show-location"]');
    if (openLocation) {
      showView('women');
      openLocationShareModal();
      return;
    }

    const voiceQuick = event.target.closest('[data-action="voice-quick"]');
    if (voiceQuick) {
      handleVoiceInput();
      return;
    }

    const emergencyView = event.target.closest('[data-action="emergency-message"]');
    if (emergencyView) {
      showView('sos');
      renderSosPanel();
      showToast('Emergency message section opened.');
      return;
    }

    const safetyCheck = event.target.closest('[data-action="safety-checkin"]');
    if (safetyCheck) {
      showView('women');
      const checkinPanel = document.getElementById('safetyCheckinPanel');
      checkinPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      checkinPanel.querySelector('[data-checkin]')?.focus({ preventScroll: true });
      return;
    }

    const unsafeMode = event.target.closest('[data-action="unsafe-mode"]');
    if (unsafeMode) {
      showView('women');
      showToast('Please move to a safe public location and contact a trusted person.');
      return;
    }

    const actionOpenContacts = event.target.closest('[data-action="open-contacts"]');
    if (actionOpenContacts) {
      showView('contacts');
      return;
    }

    const actionOpenMedicine = event.target.closest('[data-action="open-medicine"]');
    if (actionOpenMedicine) {
      showView('elderly');
      return;
    }

    const healthCheckAction = event.target.closest('[data-action="health-check"]');
    if (healthCheckAction) {
      const score = getWellnessScore();
      showToast(`Wellness score: ${score.total}/100. This is an educational indicator.`);
      return;
    }

    const waterReminderAction = event.target.closest('[data-action="water-reminder"]');
    if (waterReminderAction) {
      showView('elderly');
      const message = 'It is time to drink a glass of water. Check the water reminder section.';
      showToast(message);
      speakProfileMessage(message);
      return;
    }

    const dailyCheckinAction = event.target.closest('[data-action="daily-checkin"]');
    if (dailyCheckinAction) {
      showView('elderly');
      showToast('Daily check-in is available.');
      return;
    }

    const callFamilyAction = event.target.closest('[data-action="call-family"]');
    if (callFamilyAction) {
      const family = state.contacts.find((contact) => /family|mother|father|daughter|son|spouse/i.test(contact.relation + ' ' + contact.name));
      if (family) {
        window.location.href = `tel:${family.phone}`;
      } else {
        showToast('No family contact found. Add one in Contacts.');
      }
      return;
    }

    const appModeToggleButton = event.target.closest('#appModeToggle');
    if (appModeToggleButton) {
      applyLaunchMode('app');
      return;
    }

    const voiceButton = event.target.closest('#voiceButton');
    if (voiceButton) {
      handleVoiceInput();
      return;
    }

    const menuToggle = event.target.closest('#menuToggle');
    if (menuToggle) {
      showToast('The app menu is available on larger screens.');
      return;
    }

    const clearData = event.target.closest('#clearDataBtn');
    if (clearData) {
      clearUserData();
      return;
    }

  });

  document.getElementById('signOutButton').addEventListener('click', signOut);
  document.getElementById('profileForm').addEventListener('submit', saveProfile);
  document.getElementById('homeWellnessForm').addEventListener('submit', saveHomeWellness);
  document.getElementById('editHomeWellness').addEventListener('click', editHomeWellness);
  document.getElementById('homeWellnessForm').addEventListener('change', () => {
    homeWellnessDraftDirty = true;
  });
  document.addEventListener('change', handleDiseaseSelectionChange);
  document.addEventListener('click', (event) => {
    const addDiseaseButton = event.target.closest('[data-add-disease]');
    if (addDiseaseButton) addOtherDisease(addDiseaseButton.dataset.addDisease);
  });

  document.getElementById('loginForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const identifierInput = document.getElementById('loginIdentifier');
    const errorMessage = document.getElementById('loginError');
    const identifier = normalizeLoginIdentifier(identifierInput.value);
    if (!identifier) {
      errorMessage.textContent = 'Enter a valid email address or a mobile number with 10 to 15 digits.';
      identifierInput.setAttribute('aria-invalid', 'true');
      identifierInput.focus();
      return;
    }

    errorMessage.textContent = '';
    identifierInput.removeAttribute('aria-invalid');
    state.userIdentifier = identifier;
    safeStorageSet(STORAGE_KEYS.userIdentifier, identifier);
    applyLaunchMode('browser');
    openDashboard();
  });

  document.getElementById('clearDataBtn').addEventListener('click', clearUserData);

  document.getElementById('medicineForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const saved = addMedicineReminder({
      id: form.dataset.editId || null,
      name: document.getElementById('medicineName').value,
      time: document.getElementById('medicineTime').value,
      frequency: document.getElementById('medicineFrequency').value,
      daysOfWeek: [...document.querySelectorAll('input[name="medicineDays"]:checked')].map((checkbox) => Number(checkbox.value)),
      monthDay: document.getElementById('medicineMonthDay').value
    });
    if (!saved) return;
    form.dataset.editId = '';
    form.reset();
    populateMedicineMonthDays();
  });
  document.getElementById('medicineFrequency')?.addEventListener('change', updateMedicineMonthDayVisibility);

  document.getElementById('sosMessageBox')?.addEventListener('input', () => {
    state.lastEmergencyMessage = document.getElementById('sosMessageBox').value;
  });
    safeStorageSet(STORAGE_KEYS.launchMode, 'browser');
    applyLaunchMode('browser');

    document.addEventListener('keydown', (event) => {
      const picker = document.getElementById('conditionPicker');
      const options = picker ? Array.from(picker.querySelectorAll('[role="option"]')) : [];
      const currentOption = event.target.closest('[role="option"]');

      if (picker && currentOption) {
        const currentIndex = Array.from(options).indexOf(currentOption);
        let nextIndex = currentIndex;

        if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % options.length;
        if (event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + options.length) % options.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = options.length - 1;

        if (nextIndex !== currentIndex) {
          event.preventDefault();
          options.forEach((option, index) => {
            option.tabIndex = index === nextIndex ? 0 : -1;
          });
          options[nextIndex].focus();
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          chooseCondition(options[currentIndex]);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          closeConditionPicker(picker);
          document.getElementById('conditionPickerTrigger').focus();
        } else if (event.key === 'Tab') {
          closeConditionPicker(picker);
        }
      } else if (event.target.closest('#conditionPickerTrigger') &&
        ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        openConditionPicker(picker, event.key === 'ArrowUp');
      } else if (event.key === 'Escape') {
        document.getElementById('locationShareModal').classList.add('hidden');
        document.getElementById('profileModal').classList.add('hidden');
        applyLaunchMode('browser');
      }

    });

setTimeout(() => {
    const splash = document.getElementById('splashScreen');
    if (splash) {
      splash.classList.add('hidden');
    }
    if (state.userIdentifier) {
      openDashboard();
    } else {
      document.getElementById('loginScreen').classList.remove('hidden');
    }
  }, 0);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      console.info('Service worker was not registered. Offline support is optional for this app.');
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

const API_BASE = localStorage.getItem('sphcc_api_base') || 'http://localhost:4000/api';

const athletesList = document.getElementById('athletesList');
const appointmentsList = document.getElementById('appointmentsList');
const athleteForm = document.getElementById('athleteForm');
const appointmentForm = document.getElementById('appointmentForm');
const athleteIdSelect = document.getElementById('athleteId');

let athletesCache = [];

function renderAthletes(athletes) {
  athletesList.innerHTML = '';
  athleteIdSelect.innerHTML = '<option value="">Select athlete</option>';

  if (!athletes.length) {
    athletesList.innerHTML = '<li>No athletes yet</li>';
    return;
  }

  athletes.forEach((a) => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${a.name}</strong><div class="small">${a.sport} • Age ${a.age}</div>`;
    athletesList.appendChild(li);

    const option = document.createElement('option');
    option.value = String(a.id);
    option.textContent = `${a.name} (${a.sport})`;
    athleteIdSelect.appendChild(option);
  });
}

function renderAppointments(items) {
  appointmentsList.innerHTML = '';

  if (!items.length) {
    appointmentsList.innerHTML = '<li>No appointments yet</li>';
    return;
  }

  items.forEach((item) => {
    const li = document.createElement('li');
    const date = new Date(item.date).toLocaleString();
    li.innerHTML = `<strong>${item.athleteName || 'Athlete #' + item.athleteId}</strong><div class="small">${date}</div><div>${item.notes || 'No notes'}</div>`;
    appointmentsList.appendChild(li);
  });
}

async function fetchAthletes() {
  const res = await fetch(`${API_BASE}/athletes`);
  athletesCache = await res.json();
  renderAthletes(athletesCache);
}

async function fetchAppointments() {
  const res = await fetch(`${API_BASE}/appointments`);
  const data = await res.json();
  renderAppointments(data);
}

athleteForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    name: document.getElementById('name').value.trim(),
    sport: document.getElementById('sport').value.trim(),
    age: Number(document.getElementById('age').value)
  };

  const res = await fetch(`${API_BASE}/athletes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    alert('Could not add athlete');
    return;
  }

  athleteForm.reset();
  await fetchAthletes();
});

appointmentForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const athleteId = Number(document.getElementById('athleteId').value);
  const dateValue = document.getElementById('date').value;
  const notes = document.getElementById('notes').value.trim();

  const res = await fetch(`${API_BASE}/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      athleteId,
      date: dateValue,
      notes
    })
  });

  if (!res.ok) {
    alert('Could not create appointment');
    return;
  }

  appointmentForm.reset();
  await fetchAppointments();
});

async function init() {
  try {
    await Promise.all([fetchAthletes(), fetchAppointments()]);
  } catch (error) {
    console.error(error);
    athletesList.innerHTML = '<li>API connection failed</li>';
    appointmentsList.innerHTML = '<li>API connection failed</li>';
  }
}

init();

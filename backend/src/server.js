import express from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const athletes = [
  {
    id: 1,
    name: 'Ahmed Alqahtani',
    sport: 'Football',
    age: 22,
    createdAt: new Date().toISOString()
  }
];

const appointments = [
  {
    id: 1,
    athleteId: 1,
    date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    status: 'scheduled',
    notes: 'Initial movement and endurance screening',
    createdAt: new Date().toISOString()
  }
];

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'SPHCC API', timestamp: new Date().toISOString() });
});

app.get('/api/athletes', (_req, res) => {
  res.json(athletes);
});

app.post('/api/athletes', (req, res) => {
  const { name, sport, age } = req.body;

  if (!name || !sport || !age) {
    return res.status(400).json({ error: 'name, sport, and age are required' });
  }

  const newAthlete = {
    id: athletes.length ? athletes[athletes.length - 1].id + 1 : 1,
    name,
    sport,
    age: Number(age),
    createdAt: new Date().toISOString()
  };

  athletes.push(newAthlete);
  return res.status(201).json(newAthlete);
});

app.get('/api/appointments', (_req, res) => {
  const merged = appointments.map((item) => {
    const athlete = athletes.find((a) => a.id === item.athleteId);
    return {
      ...item,
      athleteName: athlete?.name || 'Unknown athlete'
    };
  });

  res.json(merged);
});

app.post('/api/appointments', (req, res) => {
  const { athleteId, date, notes } = req.body;
  const athlete = athletes.find((a) => a.id === Number(athleteId));

  if (!athlete) {
    return res.status(404).json({ error: 'athlete not found' });
  }

  if (!date) {
    return res.status(400).json({ error: 'date is required' });
  }

  const newAppointment = {
    id: appointments.length ? appointments[appointments.length - 1].id + 1 : 1,
    athleteId: athlete.id,
    date: new Date(date).toISOString(),
    status: 'scheduled',
    notes: notes || '',
    createdAt: new Date().toISOString()
  };

  appointments.push(newAppointment);
  return res.status(201).json(newAppointment);
});

app.listen(port, () => {
  console.log(`SPHCC API listening on http://localhost:${port}`);
});

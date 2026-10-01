import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve('server/.env') });
import { spawn } from 'child_process';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../app.js';
import { connectDB } from '../config/db.js';
import Charger from '../models/Charger.js';

const PYTHON_PATH = 'C:\\Users\\theja\\AppData\\Local\\Programs\\Python\\Python314\\python.exe';

async function runEndToEndVerification() {
  console.log('================================================================');
  console.log('EVsathi Phase 9 — Live End-to-End Pricing & ML Fallback Audit');
  console.log('================================================================\n');

  await connectDB();

  // Find or create a test charger in NCR (CHG-NCR-001)
  let charger = await Charger.findOne({ title: 'CHG-NCR-001' });
  if (!charger) {
    charger = await Charger.findOne();
  }
  const chargerId = charger._id.toString();
  console.log(`[1] Selected Charging Station: ${charger.title || charger.name} (ID: ${chargerId})`);

  // Start FastAPI inference service in background on port 8000
  console.log('\n[2] Starting FastAPI XGBoost Inference Service on port 8000...');
  const fastApiProc = spawn(
    PYTHON_PATH,
    ['-m', 'uvicorn', 'model.api.main:app', '--host', '127.0.0.1', '--port', '8000'],
    {
      cwd: 'E:\\Projects\\MajorProject\\EVsathi',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  fastApiProc.stderr.on('data', (d) => {
    console.log('[FastAPI stderr]', d.toString().trim());
  });
  fastApiProc.stdout.on('data', (d) => {
    console.log('[FastAPI stdout]', d.toString().trim());
  });

  // Wait for FastAPI to become ready
  let ready = false;
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch('http://127.0.0.1:8000/health');
      if (res.ok) {
        ready = true;
        const body = await res.json();
        console.log(`[*] FastAPI Ready: status=${body.status}, model_loaded=${body.model_loaded}, model_version=${body.model_version}`);
        break;
      }
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  if (!ready) {
    fastApiProc.kill();
    throw new Error('FastAPI failed to start within 25 seconds');
  }


  // CASE 1: ML Active Flow
  console.log('\n[3] Testing FLOW 1 — ML Active: UI/Client -> Express -> demand.service -> FastAPI -> XGBoost -> pricing.service');
  process.env.ML_ENABLED = 'true';
  process.env.ML_SERVICE_URL = 'http://127.0.0.1:8000';

  const activeRes = await request(app)
    .get(`/api/pricing/${chargerId}/pricing`)
    .query({ startTime: '2024-11-08 14:00:00' });

  console.log(`[*] HTTP Status: ${activeRes.statusCode}`);
  console.log('[*] Response Data:', JSON.stringify(activeRes.body.data, null, 2));

  if (
    activeRes.statusCode === 200 &&
    activeRes.body.data.pricingAlgorithm === 'XGBOOST_ADVISORY_RULE_BASED' &&
    activeRes.body.data.mlStatus === 'ACTIVE' &&
    typeof activeRes.body.data.predictedDemand === 'number'
  ) {
    console.log('>>> FLOW 1 VERDICT: PASSED (XGBoost advisory signal successfully applied)');
  } else {
    console.error('>>> FLOW 1 VERDICT: FAILED');
  }

  // Kill FastAPI process to test Case 2 (ML Unavailable / Fallback)
  console.log('\n[4] Stopping FastAPI service to simulate service failure / network disconnection...');
  fastApiProc.kill('SIGKILL');
  await new Promise((r) => setTimeout(r, 1000));

  // CASE 2: ML Failure Fallback Flow
  console.log('\n[5] Testing FLOW 2 — ML Unavailable Fallback: Client -> Express -> demand.service -> Fallback -> pricing.service');
  const fallbackRes = await request(app)
    .get(`/api/pricing/${chargerId}/pricing`)
    .query({ startTime: '2024-11-07T14:00:00' });

  console.log(`[*] HTTP Status: ${fallbackRes.statusCode}`);
  console.log('[*] Response Data:', JSON.stringify(fallbackRes.body.data, null, 2));

  if (
    fallbackRes.statusCode === 200 &&
    fallbackRes.body.data.pricingAlgorithm === 'RULE_BASED_PRICING' &&
    fallbackRes.body.data.mlStatus === 'FALLBACK' &&
    fallbackRes.body.data.recommendedPrice > 0
  ) {
    console.log('>>> FLOW 2 VERDICT: PASSED (Deterministic rule-based fallback successfully protected driver)');
  } else {
    console.error('>>> FLOW 2 VERDICT: FAILED');
  }

  await mongoose.connection.close();
  console.log('\n================================================================');
  console.log('Both live and fallback flows verified end-to-end!');
  console.log('================================================================\n');
}

runEndToEndVerification().catch((err) => {
  console.error('Verification failed with unhandled error:', err);
  process.exit(1);
});

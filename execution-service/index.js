require('dotenv').config();
const express = require('express');
const Docker = require('dockerode');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const app = express();
const docker = new Docker(); // Default to local socket/pipe

app.use(cors());
app.use(express.json());

const LANGUAGE_CONFIG = {
  javascript: { 
    displayName: 'JavaScript',
    image: 'node:18-alpine', 
    command: (code) => ['node', '-e', code],
    localCommand: (code) => `node -e "${code.replace(/"/g, '\\"')}"`
  },
  typescript: {
    displayName: 'TypeScript',
    image: 'node:18-alpine',
    command: (code) => ['node', '-e', code],
    localCommand: (code) => `node -e ${JSON.stringify(code)}`
  },
  python: { 
    displayName: 'Python',
    image: 'python:3.10-alpine', 
    command: (code) => ['python', '-c', code],
    localCommand: (code) => `python -c ${JSON.stringify(code)}`
  },
  cpp: { 
    displayName: 'C++',
    image: 'gcc:latest', 
    command: (code) => ['sh', '-c', `echo ${JSON.stringify(code)} > main.cpp && g++ main.cpp -o app && ./app`],
    localCommand: (code) => {
      const id = crypto.randomUUID();
      const tmpDir = os.tmpdir();
      const filePath = path.join(tmpDir, `${id}.cpp`);
      const outPath = path.join(tmpDir, `${id}.exe`);
      fs.writeFileSync(filePath, code);
      return `g++ ${filePath} -o ${outPath} && ${outPath}`;
    }
  },
  c: {
    displayName: 'C',
    image: 'gcc:latest',
    command: (code) => ['sh', '-c', `echo ${JSON.stringify(code)} > main.c && gcc main.c -o app && ./app`],
    localCommand: (code) => {
      const id = crypto.randomUUID();
      const tmpDir = os.tmpdir();
      const filePath = path.join(tmpDir, `${id}.c`);
      const outPath = path.join(tmpDir, `${id}.exe`);
      fs.writeFileSync(filePath, code);
      return `gcc ${filePath} -o ${outPath} && ${outPath}`;
    }
  },
  java: {
    displayName: 'Java',
    image: 'openjdk:17-alpine',
    command: (code) => ['sh', '-c', `echo ${JSON.stringify(code)} > Main.java && javac Main.java && java Main`],
    localCommand: (code) => {
      const id = crypto.randomUUID();
      const tmpDir = os.tmpdir();
      const filePath = path.join(tmpDir, `Main_${id}.java`);
      fs.writeFileSync(filePath, code);
      return `javac ${filePath} && java -cp ${tmpDir} Main_${id}`;
    }
  },
  go: {
    displayName: 'Go',
    image: 'golang:1.20-alpine',
    command: (code) => ['go', 'run', '-'],
    localCommand: (code) => `go run -`
  }
};

async function checkDocker() {
  try {
    await docker.ping();
    return true;
  } catch (e) {
    return false;
  }
}

const LANGUAGE_MAP = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  cpp: 'cpp',
  c: 'c',
  java: 'java',
  go: 'go',
  rs: 'rust',
  rb: 'ruby',
  php: 'php'
};

app.post('/execute', async (req, res) => {
  let { language, code } = req.body;
  
  // Normalize language from file extension if needed
  if (LANGUAGE_MAP[language]) {
    language = LANGUAGE_MAP[language];
  }
  
  console.log(`[${new Date().toISOString()}] Received execution request: ${language}, code length: ${code?.length}, first 50 chars: ${code?.substring(0,50)}`);
  
  if (!LANGUAGE_CONFIG[language]) {
    return res.status(400).json({ error: 'Unsupported language' });
  }

  const config = LANGUAGE_CONFIG[language];
  const startTime = Date.now();
  
  let isDockerAvailable = false;
  try {
    isDockerAvailable = await checkDocker();
  } catch (e) {
    console.log('Docker check failed:', e.message);
  }

  if (isDockerAvailable) {
    console.log(`Executing ${language} in Docker...`);
    try {
      const container = await docker.createContainer({
        Image: config.image,
        Cmd: config.command(code),
        AttachStdout: true,
        AttachStderr: true,
        Tty: false,
        HostConfig: {
          Memory: 128 * 1024 * 1024,
          CpuQuota: 50000,
          NetworkMode: 'none'
        }
      });

      await container.start();
      const result = await container.wait();
      const logs = await container.logs({ stdout: true, stderr: true });
      
      let output = "";
      let offset = 0;
      while (offset < logs.length) {
        const type = logs.readUInt8(offset);
        const size = logs.readUInt32BE(offset + 4);
        output += logs.slice(offset + 8, offset + 8 + size).toString();
        offset += 8 + size;
      }
      
      await container.remove();
      
      return res.json({
        output: output,
        exitCode: result.StatusCode,
        executionTime: Date.now() - startTime
      });
    } catch (err) {
      console.error('Docker execution failed, falling back to local:', err.message);
    }
  }

  console.log(`Executing ${language} locally (Fallback Active)...`);
  try {
    const command = config.localCommand(code);
    console.log('Local command:', command);
    exec(command, { timeout: 10000, maxBuffer: 1024 * 512 }, (error, stdout, stderr) => {
      console.log('Local result - stdout:', stdout, 'stderr:', stderr, 'error:', error);
      res.json({
        output: stdout || "",
        error: stderr || (error ? error.message : ""),
        exitCode: error ? error.code : 0,
        executionTime: Date.now() - startTime,
        fallback: true
      });
    });
  } catch (err) {
    res.status(500).json({ error: `Local execution failed: ${err.message}` });
  }
});

const PORT = process.env.EXECUTION_PORT || 5001;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Execution service listening on port ${PORT}`);
});

// Keep process alive
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

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
    image: 'node:18-alpine', 
    command: (code) => ['node', '-e', code],
    localCommand: (code) => `node -e ${JSON.stringify(code)}`
  },
  python: { 
    image: 'python:3.10-alpine', 
    command: (code) => ['python', '-c', code],
    localCommand: (code) => `python -c ${JSON.stringify(code)}`
  },
  cpp: { 
    image: 'gcc:latest', 
    // For C++, we'd need a more complex setup to compile and run in one go or use a script
    command: (code) => ['sh', '-c', `echo ${JSON.stringify(code)} > main.cpp && g++ main.cpp -o app && ./app`],
    localCommand: (code) => {
      const id = crypto.randomUUID();
      const tmpDir = os.tmpdir();
      const filePath = path.join(tmpDir, `${id}.cpp`);
      const outPath = path.join(tmpDir, `${id}.exe`);
      fs.writeFileSync(filePath, code);
      return `g++ ${filePath} -o ${outPath} && ${outPath}`;
    }
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

app.post('/execute', async (req, res) => {
  const { language, code } = req.body;
  
  if (!LANGUAGE_CONFIG[language]) {
    return res.status(400).json({ error: 'Unsupported language' });
  }

  const config = LANGUAGE_CONFIG[language];
  const startTime = Date.now();
  
  const isDockerAvailable = await checkDocker();

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
      
      // Docker multiplexed stream format: [8-byte header][payload]
      // Header: [1-byte type][3-bytes zero][4-bytes size]
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
      // Fall through to local execution
    }
  }

  // Local Fallback
  console.log(`Executing ${language} locally...`);
  try {
    const command = config.localCommand(code);
    exec(command, { timeout: 10000, maxBuffer: 1024 * 512 }, (error, stdout, stderr) => {
      res.json({
        output: stdout || "",
        error: stderr || (error ? error.message : ""),
        exitCode: error ? error.code : 0,
        executionTime: Date.now() - startTime
      });
    });
  } catch (err) {
    res.status(500).json({ error: `Local execution failed: ${err.message}` });
  }
});

const PORT = process.env.EXECUTION_PORT || 5001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Execution service listening on port ${PORT}`);
});

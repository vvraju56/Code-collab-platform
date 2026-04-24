require('dotenv').config();
const express = require('express');
const Docker = require('dockerode');
const cors = require('cors');

const app = express();
const docker = new Docker();

app.use(cors());
app.use(express.json());

const LANGUAGE_CONFIG = {
  javascript: { image: 'node:18-alpine', command: (file) => ['node', file], filename: 'index.js' },
  python: { image: 'python:3.10-alpine', command: (file) => ['python', file], filename: 'main.py' },
  cpp: { image: 'gcc:latest', command: (file) => ['sh', '-c', `g++ ${file} -o app && ./app`], filename: 'main.cpp' }
};

app.post('/execute', async (req, res) => {
  const { language, code } = req.body;
  
  if (!LANGUAGE_CONFIG[language]) {
    return res.status(400).json({ error: 'Unsupported language' });
  }

  const config = LANGUAGE_CONFIG[language];
  
  try {
    // Create container
    const container = await docker.createContainer({
      Image: config.image,
      Cmd: config.command(config.filename),
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
      HostConfig: {
        Memory: 128 * 1024 * 1024, // 128MB
        CpuQuota: 50000, // 50% of one CPU
        NetworkMode: 'none' // Disable network for security
      }
    });

    // Write file to container (simplified for this demo - real app would mount a volume or use tar)
    // For now, we'll use a hacky way to inject code or assume it's pre-mounted
    // In a production app, you'd use container.putArchive or a shared volume
    
    // Start container
    await container.start();
    
    // Wait for container to finish
    const result = await container.wait();
    
    // Get logs
    const logs = await container.logs({ stdout: true, stderr: true });
    
    // Clean up
    await container.remove();
    
    res.json({
      output: logs.toString(),
      exitCode: result.StatusCode
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Execution service listening on port ${PORT}`);
});

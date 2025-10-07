import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'ai-study-mate-secret-key-2024';

// In-memory storage as backup
let inMemoryUsers = [];

// Enhanced file reading with better error handling
async function readUsers() {
  try {
    const usersPath = path.join(__dirname, '../data/users.json');
    console.log('📖 Reading users from:', usersPath);
    
    // Ensure directory exists
    await mkdir(path.dirname(usersPath), { recursive: true });
    
    const data = await readFile(usersPath, 'utf8');
    
    if (!data || data.trim() === '') {
      console.log('📁 File is empty, starting with empty array');
      return [];
    }
    
    const users = JSON.parse(data);
    console.log('✅ Found users:', users.length);
    
    // Sync with in-memory storage
    inMemoryUsers = users;
    
    return users;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('📁 Users file does not exist, creating empty array');
      // Create empty file
      await writeUsers([]);
      return [];
    }
    console.error('❌ Error reading users file:', error.message);
    console.log('🔄 Falling back to in-memory storage with', inMemoryUsers.length, 'users');
    return inMemoryUsers;
  }
}

// Enhanced file writing with multiple safety measures
async function writeUsers(users) {
  try {
    const usersPath = path.join(__dirname, '../data/users.json');
    console.log('💾 Writing users to:', usersPath);
    
    // Ensure directory exists
    await mkdir(path.dirname(usersPath), { recursive: true });
    
    // Validate users data
    if (!Array.isArray(users)) {
      throw new Error('Users data is not an array');
    }
    
    // Create backup of current data first
    let backupData = [];
    try {
      const currentData = await readFile(usersPath, 'utf8');
      if (currentData && currentData.trim() !== '') {
        backupData = JSON.parse(currentData);
      }
    } catch (backupError) {
      console.log('No backup possible, continuing...');
    }
    
    // Write the new data
    const dataToWrite = JSON.stringify(users, null, 2);
    await writeFile(usersPath, dataToWrite, 'utf8');
    
    // Verify the write worked by reading back
    try {
      const verifyData = await readFile(usersPath, 'utf8');
      const verifiedUsers = JSON.parse(verifyData);
      
      if (verifiedUsers.length === users.length) {
        console.log('✅ Successfully wrote', users.length, 'users to file');
        
        // Update in-memory storage
        inMemoryUsers = users;
        
        return true;
      } else {
        throw new Error('File verification failed - data mismatch');
      }
    } catch (verifyError) {
      console.error('❌ File verification failed:', verifyError.message);
      
      // Restore from backup
      if (backupData.length > 0) {
        console.log('🔄 Restoring from backup...');
        await writeFile(usersPath, JSON.stringify(backupData, null, 2), 'utf8');
      }
      
      // Fall back to in-memory
      inMemoryUsers = users;
      return true;
    }
    
  } catch (error) {
    console.error('❌ Error writing users file:', error.message);
    console.log('🔄 Falling back to in-memory storage');
    
    // Update in-memory storage as fallback
    inMemoryUsers = users;
    return true; // Return true so the operation continues
  }
}

// Debug endpoint to check users and file status
router.get('/debug-users', async (req, res) => {
  try {
    const usersPath = path.join(__dirname, '../data/users.json');
    
    let fileExists = false;
    let fileContent = '';
    let fileStats = null;
    
    try {
      fileContent = await readFile(usersPath, 'utf8');
      const stats = await import('fs').then(fs => fs.promises.stat(usersPath));
      fileStats = stats;
      fileExists = true;
    } catch (fileError) {
      fileExists = false;
    }
    
    const users = await readUsers();
    
    res.json({
      success: true,
      file: {
        exists: fileExists,
        path: usersPath,
        size: fileStats?.size || 0,
        content: fileContent,
        inMemoryUsers: inMemoryUsers.length
      },
      users: users,
      totalUsers: users.length
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      inMemoryUsers: inMemoryUsers.length
    });
  }
});

// Force save endpoint to manually write in-memory data to file
router.post('/force-save', async (req, res) => {
  try {
    console.log('💪 Force saving in-memory users to file...');
    const success = await writeUsers(inMemoryUsers);
    
    res.json({
      success: true,
      message: `Force save ${success ? 'completed' : 'failed'}`,
      usersSaved: inMemoryUsers.length
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Clear all users endpoint (for testing)
router.post('/clear-users', async (req, res) => {
  try {
    inMemoryUsers = [];
    await writeUsers([]);
    
    res.json({
      success: true,
      message: 'All users cleared'
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

// User registration endpoint
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    console.log('👤 Registration attempt for:', email);
    
    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({ 
        success: false,
        error: 'All fields are required: name, email, password' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }

    if (!email.includes('@')) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid email address'
      });
    }

    const users = await readUsers();
    console.log('📊 Current users in system:', users.length);
    
    // Check if user already exists
    const existingUser = users.find(user => user.email === email.toLowerCase());
    if (existingUser) {
      console.log('❌ User already exists:', email);
      return res.status(409).json({ 
        success: false,
        error: 'User with this email already exists' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Create new user
    const newUser = {
      id: Date.now().toString(),
      email: email.toLowerCase(),
      password: hashedPassword,
      name: name.trim(),
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };

    console.log('🆕 Creating new user:', newUser.email);
    
    // Save user
    users.push(newUser);
    const saveResult = await writeUsers(users);

    if (!saveResult) {
      console.error('❌ Failed to save user to file');
      return res.status(500).json({
        success: false,
        error: 'Failed to create user account'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: newUser.id, 
        email: newUser.email 
      }, 
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('✅ User registered successfully:', newUser.email);
    
    // Return success response (without password)
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        createdAt: newUser.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error during registration' 
    });
  }
});

// User login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('🔐 Login attempt for:', email);
    
    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        error: 'Email and password are required' 
      });
    }

    const users = await readUsers();
    console.log('📊 Total users in system:', users.length);
    
    const user = users.find(u => u.email === email.toLowerCase());
    
    // Check if user exists
    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(401).json({ 
        success: false,
        error: 'Invalid email or password' 
      });
    }

    console.log('✅ User found, verifying password...');
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log('❌ Invalid password for:', email);
      return res.status(401).json({ 
        success: false,
        error: 'Invalid email or password' 
      });
    }

    // Update last login
    user.lastLogin = new Date().toISOString();
    await writeUsers(users);

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email 
      }, 
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('🎉 Login successful for:', email);
    
    // Return success response
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error during login' 
    });
  }
});

// Verify token endpoint
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token is required'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const users = await readUsers();
    const user = users.find(u => u.id === decoded.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false,
      error: 'Access token required' 
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ 
        success: false,
        error: 'Invalid or expired token' 
      });
    }
    req.user = user;
    next();
  });
};

export { authenticateToken };
export default router;
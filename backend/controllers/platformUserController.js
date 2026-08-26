const PlatformUser = require('../models/platformUserModel');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const sessionService = require('../services/sessionService');
const mfaService = require('../services/mfaService');

// Create email transporter (configure with your SMTP settings)
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// @desc    Authenticate a platform operator
// @route   POST /api/platform-users/login
// @access  Public
exports.loginPlatformUser = async (req, res) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis' });
    }

    const user = await PlatformUser.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Email ou mot de passe invalide' });
    }
    if (user.isActive === false) {
      return res.status(403).json({
        message: 'Votre compte a été désactivé. Veuillez contacter le super administrateur.',
        code: 'ACCOUNT_INACTIVE',
      });
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    // Phase 0.8 : session plateforme (appareil/IP).
    await sessionService.recordSession({
      kind: 'platform',
      userId: user._id,
      device: req.headers['user-agent'] || 'Unknown device',
      ip: req.ip || req.headers['x-forwarded-for'] || '',
      userAgent: req.headers['user-agent'] || '',
      tokenVersion: user.tokenVersion ?? 0,
    });

    const token = jwt.sign(
      { platformUserId: String(user._id) },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    return res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: Array.isArray(user.permissions) ? user.permissions : [],
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error('Platform login error:', error);
    return res.status(500).json({ message: 'Erreur serveur lors de la connexion' });
  }
};

// @desc    Get all platform users
// @route   GET /api/platform-users
// @access  Super Admin
exports.getAllPlatformUsers = async (req, res) => {
  try {
    const users = await PlatformUser.find({})
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      users,
      total: users.length,
    });
  } catch (error) {
    console.error('Error fetching platform users:', error);
    res.status(500).json({ message: 'Erreur serveur lors de la recuperation des utilisateurs' });
  }
};

// @desc    Create a new platform user
// @route   POST /api/platform-users
// @access  Super Admin
exports.createPlatformUser = async (req, res) => {
  try {
    const { name, email, phone, password, role, permissions } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Nom, email et mot de passe requis' });
    }

    // Check if user already exists
    const existingUser = await PlatformUser.findOne({
      $or: [
        { email },
        ...(phone ? [{ phone }] : [])
      ]
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({ message: 'Cet email existe deja' });
      }
      if (existingUser.phone === phone) {
        return res.status(400).json({ message: 'Ce numero de telephone existe deja' });
      }
    }

    // Le hachage est géré par le hook pre-save du modèle (comme userModel).
    const newUser = await PlatformUser.create({
      name,
      email,
      phone: phone || undefined,
      password,
      role: role || 'support',
      permissions: permissions || [],
      createdBy: req.user?._id || req.platformUser?._id || null,
    });

    res.status(201).json({
      message: 'Utilisateur cree avec succes',
      user: {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
        permissions: newUser.permissions,
        isActive: newUser.isActive,
      },
    });
  } catch (error) {
    console.error('Error creating platform user:', error);
    res.status(500).json({ message: 'Erreur serveur lors de la creation de l utilisateur' });
  }
};

// @desc    Update user role and permissions
// @route   PATCH /api/platform-users/:userId
// @access  Super Admin
exports.updatePlatformUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, permissions, isActive, phone } = req.body;

    const user = await PlatformUser.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }

    // Check if phone is being updated and if it already exists
    if (phone && phone !== user.phone) {
      const existingPhone = await PlatformUser.findOne({ phone, _id: { $ne: userId } });
      if (existingPhone) {
        return res.status(400).json({ message: 'Ce numero de telephone existe deja' });
      }
      user.phone = phone;
    }

    // Update fields if provided
    if (role) user.role = role;
    if (permissions !== undefined) user.permissions = permissions;
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();

    res.json({
      message: 'Utilisateur mis a jour avec succes',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        permissions: user.permissions,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error('Error updating platform user:', error);
    res.status(500).json({ message: 'Erreur serveur lors de la mise a jour' });
  }
};

// @desc    Delete platform user
// @route   DELETE /api/platform-users/:userId
// @access  Super Admin
exports.deletePlatformUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await PlatformUser.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }

    // Prevent deleting super-admins
    if (user.role === 'super-admin') {
      return res.status(403).json({ message: 'Impossible de supprimer un super-admin' });
    }

    await PlatformUser.findByIdAndDelete(userId);

    res.json({ message: 'Utilisateur supprime avec succes' });
  } catch (error) {
    console.error('Error deleting platform user:', error);
    res.status(500).json({ message: 'Erreur serveur lors de la suppression' });
  }
};

// @desc    Send email to multiple users
// @route   POST /api/platform-users/send-email
// @access  Super Admin
exports.sendEmailToUsers = async (req, res) => {
  try {
    const { userIds, subject, message } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'Liste d utilisateurs requise' });
    }

    if (!subject || !message) {
      return res.status(400).json({ message: 'Sujet et message requis' });
    }

    // Check if email is configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.status(500).json({ message: 'Configuration email manquante. Verifiez EMAIL_USER et EMAIL_PASS dans .env' });
    }

    // Fetch users
    const users = await PlatformUser.find({ _id: { $in: userIds }, isActive: true });

    if (users.length === 0) {
      return res.status(400).json({ message: 'Aucun utilisateur actif trouve' });
    }

    const emailAddresses = users.map(u => u.email).filter(Boolean);

    if (emailAddresses.length === 0) {
      return res.status(400).json({ message: 'Aucune adresse email valide trouvee' });
    }

    // Create transporter
    const transporter = createTransporter();

    // Send email
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'ETS HD Home Decor'}" <${process.env.EMAIL_USER}>`,
      bcc: emailAddresses, // Use BCC to hide recipients from each other
      subject: subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 24px;">ETS HD Home Decor</h1>
            </div>
            <div class="content">
              ${message.replace(/\n/g, '<br>')}
            </div>
            <div class="footer">
              <p>Cet email a ete envoye par l administrateur de la plateforme ETS HD Home Decor</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: message, // Plain text fallback
    };

    await transporter.sendMail(mailOptions);

    res.json({
      message: `Email envoye avec succes a ${emailAddresses.length} utilisateur(s)`,
      recipients: users.map(u => ({ name: u.name, email: u.email })),
    });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({
      message: 'Erreur lors de l envoi de l email',
      error: error.message,
    });
  }
};

// ── MFA TOTP opérateur plateforme (Phase 0.8) ──

// @desc    Préparer MFA (renvoie secret + URL d'application d'authentification)
// @route   POST /api/platform-users/mfa/setup
exports.mfaSetup = async (req, res) => {
  try {
    const setup = mfaService.setup(req.platformUser.email);
    req.platformUser.mfaSecret = setup.secret;
    req.platformUser.mfaEnabled = false;
    await req.platformUser.save({ validateBeforeSave: false });
    res.json({ secret: setup.secret, otpauthUrl: setup.otpauthUrl });
  } catch (error) {
    console.error('MFA setup error:', error);
    res.status(500).json({ message: 'Erreur lors de la préparation MFA.' });
  }
};

// @desc    Activer MFA après vérification d'un code
// @route   POST /api/platform-users/mfa/verify
exports.mfaVerify = async (req, res) => {
  try {
    const code = String(req.body.code || '').trim();
    if (!code) return res.status(400).json({ message: 'Code requis.' });
    if (!req.platformUser.mfaSecret || !mfaService.verifyCode(req.platformUser.mfaSecret, code)) {
      return res.status(400).json({ message: 'Code MFA invalide.' });
    }
    req.platformUser.mfaEnabled = true;
    await req.platformUser.save({ validateBeforeSave: false });
    res.json({ mfaEnabled: true });
  } catch (error) {
    console.error('MFA verify error:', error);
    res.status(500).json({ message: 'Erreur lors de la vérification MFA.' });
  }
};

// @desc    Désactiver MFA (mot de passe requis)
// @route   POST /api/platform-users/mfa/disable
exports.mfaDisable = async (req, res) => {
  try {
    const password = String(req.body.password || '');
    if (!password || !(await req.platformUser.matchPassword(password))) {
      return res.status(401).json({ message: 'Mot de passe invalide.' });
    }
    req.platformUser.mfaEnabled = false;
    req.platformUser.mfaSecret = null;
    await req.platformUser.save({ validateBeforeSave: false });
    res.json({ mfaEnabled: false });
  } catch (error) {
    console.error('MFA disable error:', error);
    res.status(500).json({ message: 'Erreur lors de la désactivation MFA.' });
  }
};

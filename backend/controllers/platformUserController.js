const PlatformUser = require('../models/platformUserModel');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

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

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new platform user
    const newUser = await PlatformUser.create({
      name,
      email,
      phone: phone || undefined,
      password: hashedPassword,
      role: role || 'support',
      permissions: permissions || [],
      createdBy: req.user._id,
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

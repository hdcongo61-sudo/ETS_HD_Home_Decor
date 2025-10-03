const mongoose = require('mongoose');

const loginHistorySchema = mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        ipAddress: {
            type: String,
            required: true
        },
        device: {
            type: String,
            required: true
        },
        success: {
            type: Boolean,
            required: true,
            default: false
        },
        attemptedEmail: {
            type: String,
            default: null
        },
        error: {
            type: String,
            default: null
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

// Add virtual for formatted timestamp
loginHistorySchema.virtual('timestampFormatted').get(function () {
    return this.createdAt.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
});

module.exports = mongoose.model('LoginHistory', loginHistorySchema);


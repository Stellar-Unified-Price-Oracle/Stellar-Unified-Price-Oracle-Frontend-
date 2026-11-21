import React, { useState } from 'react';
import { maskSecret } from '../utils/maskSecret';

interface NotificationChannelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  webhookUrl?: string;
  webhookSecret?: string;
}

const NotificationChannelsModal: React.FC<NotificationChannelsModalProps> = ({
  isOpen,
  onClose,
  webhookUrl,
  webhookSecret,
}) => {
  const [showSecret, setShowSecret] = useState(false);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-content">
        <h2>Notification Channels</h2>

        <div className="channel-field">
          <label>Webhook URL</label>
          <span className="channel-value">{webhookUrl || 'Not configured'}</span>
        </div>

        <div className="channel-field">
          <label>Webhook Secret</label>
          <span className="channel-value">
            {webhookSecret
              ? showSecret
                ? webhookSecret
                : maskSecret(webhookSecret)
              : 'Not configured'}
          </span>
          {webhookSecret && (
            <button
              type="button"
              onClick={() => setShowSecret((prev) => !prev)}
            >
              {showSecret ? 'Hide' : 'Show'}
            </button>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationChannelsModal;

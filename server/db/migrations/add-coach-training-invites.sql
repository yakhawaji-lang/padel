-- Coach training WhatsApp invites — shown in member account until dismissed
CREATE TABLE IF NOT EXISTS coach_training_invites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id VARCHAR(255) NOT NULL,
  booking_id VARCHAR(255) NOT NULL,
  coach_member_id VARCHAR(255) NOT NULL,
  invitee_member_id VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  dismissed_at DATETIME NULL,
  UNIQUE KEY uq_cti_booking_invitee (booking_id, invitee_member_id),
  INDEX idx_cti_invitee (invitee_member_id, club_id)
);

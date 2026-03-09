/**
 * Booking System V2 migration - run via init-db or script
 */
import { query } from './pool.js'

async function columnExists(table, column) {
  try {
    const { rows } = await query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column]
    )
    return rows.length > 0
  } catch {
    return false
  }
}

async function tableExists(table) {
  try {
    const { rows } = await query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [table]
    )
    return rows.length > 0
  } catch {
    return false
  }
}

export async function runMigration() {
  if (!(await tableExists('booking_slot_locks'))) {
    await query(`
      CREATE TABLE booking_slot_locks (
        id VARCHAR(64) PRIMARY KEY,
        club_id VARCHAR(255) NOT NULL,
        court_id VARCHAR(255) NOT NULL,
        booking_date DATE NOT NULL,
        start_time VARCHAR(10) NOT NULL,
        end_time VARCHAR(10) NOT NULL,
        member_id VARCHAR(255) NOT NULL,
        booking_id VARCHAR(255) NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_bsl_slot (club_id, court_id, booking_date, start_time),
        INDEX idx_bsl_expires (expires_at)
      )
    `)
  }

  const clubSettingsCols = ['lock_minutes', 'payment_deadline_minutes', 'split_manage_minutes', 'split_payment_deadline_minutes', 'refund_days', 'allow_incomplete_bookings']
  for (const col of clubSettingsCols) {
    if (!(await columnExists('club_settings', col))) {
      const def = col === 'allow_incomplete_bookings' ? '0' : (col.includes('minutes') ? '10' : col === 'refund_days' ? '3' : '10')
      const type = col === 'allow_incomplete_bookings' ? 'TINYINT(1)' : 'INT'
      await query(`ALTER TABLE club_settings ADD COLUMN \`${col}\` ${type} DEFAULT ${def}`)
    }
  }

  const clubBookingsCols = ['start_time', 'end_time', 'locked_at', 'payment_deadline_at', 'total_amount', 'paid_amount', 'initiator_member_id']
  for (const col of clubBookingsCols) {
    if (!(await columnExists('club_bookings', col))) {
      const type = col.includes('_at') ? 'DATETIME' : col.includes('amount') ? 'DECIMAL(10,2)' : col.includes('member') ? 'VARCHAR(255)' : 'VARCHAR(10)'
      const def = col.includes('amount') ? 'DEFAULT 0' : 'NULL'
      await query(`ALTER TABLE club_bookings ADD COLUMN \`${col}\` ${type} ${def}`)
    }
  }

  const bpsCols = ['invite_token', 'paid_at', 'payment_reference']
  for (const col of bpsCols) {
    if (!(await columnExists('booking_payment_shares', col))) {
      const type = col === 'paid_at' ? 'DATETIME' : 'VARCHAR(255)'
      await query(`ALTER TABLE booking_payment_shares ADD COLUMN \`${col}\` ${type} NULL`)
    }
  }
  try {
    await query('CREATE INDEX idx_bps_invite_token ON booking_payment_shares (invite_token)')
  } catch (e) {
    if (!e.message?.includes('Duplicate')) throw e
  }

  if (!(await tableExists('booking_refunds'))) {
    await query(`
      CREATE TABLE booking_refunds (
        id INT AUTO_INCREMENT PRIMARY KEY,
        booking_id VARCHAR(255) NOT NULL,
        club_id VARCHAR(255) NOT NULL,
        member_id VARCHAR(255) NULL,
        amount DECIMAL(10,2) NOT NULL,
        status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
        expected_by_date DATE NULL,
        completed_at DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_br_booking (booking_id, club_id)
      )
    `)
  }

  if (!(await tableExists('member_favorites'))) {
    await query(`
      CREATE TABLE member_favorites (
        member_id VARCHAR(255) NOT NULL,
        favorite_member_id VARCHAR(255) NOT NULL,
        club_id VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (member_id, favorite_member_id, club_id)
      )
    `)
  }

  await query(`
    UPDATE club_bookings SET start_time = time_slot 
    WHERE start_time IS NULL AND time_slot IS NOT NULL
  `)
}

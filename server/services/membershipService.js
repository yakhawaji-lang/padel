/**
 * خدمة العضويات - المصدر الوحيد لكتابة جدول member_clubs
 */
import { query } from '../db/pool.js'
import { logAudit } from '../db/audit.js'

export async function addMemberToClub(memberId, clubId) {
  if (!memberId || !clubId) return false
  const mid = String(memberId).trim()
  const cid = String(clubId).trim()
  try {
    await query('INSERT IGNORE INTO member_clubs (member_id, club_id) VALUES (?, ?)', [mid, cid])
    return true
  } catch (e) {
    console.error('membershipService.addMemberToClub:', e?.message)
    return false
  }
}

export async function removeMemberFromClub(memberId, clubId, actor = {}) {
  if (!memberId || !clubId) return false
  const mid = String(memberId)
  const cid = String(clubId)
  try {
    await query('DELETE FROM member_clubs WHERE member_id = ? AND club_id = ?', [mid, cid])
    await logAudit({ tableName: 'member_clubs', recordId: mid + ':' + cid, action: 'DELETE', ...actor, clubId: cid, newValue: { memberId: mid, clubId: cid } })
    return true
  } catch (e) {
    console.error('membershipService.removeMemberFromClub:', e?.message)
    return false
  }
}

export async function setMemberClubs(memberId, clubIds) {
  if (!memberId) return
  const mid = String(memberId)
  const list = Array.isArray(clubIds) ? clubIds.map(c => String(c)).filter(Boolean) : []
  try {
    const clubIdsSet = new Set(list)
    const { rows: existing } = await query('SELECT club_id, is_coach FROM member_clubs WHERE member_id = ?', [mid])
    const existingClubs = new Set((existing || []).map(r => r.club_id))
    for (const r of existing || []) {
      if (!clubIdsSet.has(r.club_id)) {
        await query('DELETE FROM member_clubs WHERE member_id = ? AND club_id = ?', [mid, r.club_id])
      }
    }
    for (const cid of list) {
      if (!existingClubs.has(cid)) {
        await query('INSERT IGNORE INTO member_clubs (member_id, club_id, is_coach) VALUES (?, ?, 0)', [mid, cid])
      }
    }
  } catch (e) {
    if (e?.message?.includes('Unknown column') && e?.message?.includes('is_coach')) {
      try {
        await query('ALTER TABLE member_clubs ADD COLUMN is_coach TINYINT(1) DEFAULT 0')
        return setMemberClubs(memberId, clubIds)
      } catch (migErr) {
        if (!migErr?.message?.includes('Duplicate column')) throw migErr
        return setMemberClubs(memberId, clubIds)
      }
    }
    console.error('membershipService.setMemberClubs:', e?.message)
    throw e
  }
}

export async function setClubMembers(clubId, memberIds) {
  if (!clubId) return
  const cid = String(clubId)
  const list = Array.isArray(memberIds) ? memberIds.map(m => String(m)).filter(Boolean) : []
  try {
    const memberIdsSet = new Set(list)
    const { rows: existing } = await query('SELECT member_id, is_coach FROM member_clubs WHERE club_id = ?', [cid])
    const existingIds = new Set((existing || []).map(r => r.member_id))
    for (const r of existing || []) {
      if (!memberIdsSet.has(r.member_id)) {
        await query('DELETE FROM member_clubs WHERE member_id = ? AND club_id = ?', [r.member_id, cid])
      }
    }
    for (const mid of list) {
      if (!existingIds.has(mid)) {
        await query('INSERT IGNORE INTO member_clubs (member_id, club_id, is_coach) VALUES (?, ?, 0)', [mid, cid])
      }
    }
  } catch (e) {
    if (e?.message?.includes('Unknown column') && e?.message?.includes('is_coach')) {
      try {
        await query('ALTER TABLE member_clubs ADD COLUMN is_coach TINYINT(1) DEFAULT 0')
        return setClubMembers(clubId, memberIds)
      } catch (migErr) {
        if (!migErr?.message?.includes('Duplicate column')) throw migErr
        return setClubMembers(clubId, memberIds)
      }
    }
    console.error('membershipService.setClubMembers:', e?.message)
    throw e
  }
}

export async function removeAllMembershipsForMember(memberId) {
  if (!memberId) return
  try {
    await query('DELETE FROM member_clubs WHERE member_id = ?', [String(memberId)])
  } catch (e) {
    console.error('membershipService.removeAllMembershipsForMember:', e?.message)
    throw e
  }
}

export async function removeAllMembershipsForClub(clubId) {
  if (!clubId) return
  try {
    await query('DELETE FROM member_clubs WHERE club_id = ?', [String(clubId)])
  } catch (e) {
    console.error('membershipService.removeAllMembershipsForClub:', e?.message)
    throw e
  }
}

/** Set or unset a member as coach for a club. Member must already be in the club. */
export async function setMemberCoachStatus(memberId, clubId, isCoach, actor = {}) {
  if (!memberId || !clubId) return false
  const mid = String(memberId)
  const cid = String(clubId)
  try {
    const { rows } = await query('SELECT 1 FROM member_clubs WHERE member_id = ? AND club_id = ?', [mid, cid])
    if (!rows?.length) return false
    await query(
      'UPDATE member_clubs SET is_coach = ? WHERE member_id = ? AND club_id = ?',
      [isCoach ? 1 : 0, mid, cid]
    )
    return true
  } catch (e) {
    if (e?.message?.includes('Unknown column') && e?.message?.includes('is_coach')) {
      try {
        await query('ALTER TABLE member_clubs ADD COLUMN is_coach TINYINT(1) DEFAULT 0')
        await query(
          'UPDATE member_clubs SET is_coach = ? WHERE member_id = ? AND club_id = ?',
          [isCoach ? 1 : 0, mid, cid]
        )
        return true
      } catch (migErr) {
        if (migErr?.message?.includes('Duplicate column')) {
          await query(
            'UPDATE member_clubs SET is_coach = ? WHERE member_id = ? AND club_id = ?',
            [isCoach ? 1 : 0, mid, cid]
          )
          return true
        }
        console.warn('member_clubs.is_coach auto-migration:', migErr?.message)
        return false
      }
    }
    console.error('membershipService.setMemberCoachStatus:', e?.message)
    throw e
  }
}

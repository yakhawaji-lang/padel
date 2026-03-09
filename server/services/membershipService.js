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
    await query('DELETE FROM member_clubs WHERE member_id = ?', [mid])
    for (const cid of list) {
      await query('INSERT IGNORE INTO member_clubs (member_id, club_id) VALUES (?, ?)', [mid, cid])
    }
  } catch (e) {
    console.error('membershipService.setMemberClubs:', e?.message)
    throw e
  }
}

export async function setClubMembers(clubId, memberIds) {
  if (!clubId) return
  const cid = String(clubId)
  const list = Array.isArray(memberIds) ? memberIds.map(m => String(m)).filter(Boolean) : []
  try {
    await query('DELETE FROM member_clubs WHERE club_id = ?', [cid])
    for (const mid of list) {
      await query('INSERT IGNORE INTO member_clubs (member_id, club_id) VALUES (?, ?)', [mid, cid])
    }
  } catch (e) {
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

/**
 * إعادة ربط العضو بنادي Best Padel في member_clubs.
 * يشغّل من جذر المشروع: node server/scripts/relink-member-to-best-padel.js
 * يستخدم DATABASE_URL من .env
 * - إن وُجد عضو بالبريد a@a.com يُربط به.
 * - وإلا يُربط كل عضو ليس له أي نادي في member_clubs (من فقدوا العضوية).
 */
import { query } from '../db/pool.js'
import { addMemberToClub } from '../services/membershipService.js'

const MEMBER_EMAIL = 'a@a.com'
const CLUB_ID_OR_NAME = 'best-padel'

async function run() {
  try {
    const { rows: clubRows } = await query(
      `SELECT id, name FROM clubs WHERE id LIKE ? OR name LIKE ? OR name_ar LIKE ? LIMIT 1`,
      [`%${CLUB_ID_OR_NAME}%`, `%Best%Padel%`, `%بيست%بادل%`]
    )
    const club = clubRows?.[0]
    if (!club) {
      console.log('لم يُعثر على نادي Best Padel.')
      process.exit(1)
    }
    const clubId = club.id
    console.log('النادي:', club.name, '(id:', clubId, ')')

    let memberIdsToLink = []
    const { rows: byEmail } = await query(
      `SELECT id, name, email FROM members WHERE email = ? LIMIT 1`,
      [MEMBER_EMAIL]
    )
    if (byEmail?.length > 0) {
      memberIdsToLink = [byEmail[0].id]
      console.log('عضو بالبريد', MEMBER_EMAIL, ':', byEmail[0].name || byEmail[0].email)
    } else {
      const { rows: allMembers } = await query(
        `SELECT id, name, email FROM members LIMIT 500`
      )
      if (!allMembers?.length) {
        console.log('لا يوجد أعضاء في جدول members.')
        process.exit(1)
      }
      const { rows: inAnyClub } = await query(
        `SELECT DISTINCT member_id FROM member_clubs`
      )
      const hasClub = new Set((inAnyClub || []).map(r => String(r.member_id)))
      memberIdsToLink = allMembers.filter(m => !hasClub.has(String(m.id))).map(m => m.id)
      if (memberIdsToLink.length === 0) {
        console.log('كل الأعضاء مربوطون بنوادٍ. لا أحد يحتاج إعادة ربط.')
        process.exit(0)
      }
      console.log('أعضاء بدون أي نادي:', memberIdsToLink.length)
    }

    let linked = 0
    for (const memberId of memberIdsToLink) {
      const { rows: ex } = await query(
        `SELECT 1 FROM member_clubs WHERE member_id = ? AND club_id = ? LIMIT 1`,
        [memberId, clubId]
      )
      if (ex?.length > 0) continue
      await addMemberToClub(memberId, clubId)
      linked++
    }
    console.log('تم إعادة ربط', linked, 'عضو/أعضاء بنادي Best Padel.')
    process.exit(0)
  } catch (e) {
    console.error('فشل:', e?.message || e)
    process.exit(1)
  }
}

run()

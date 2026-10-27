// 云数据库封装：统一集合名与常用查询
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const COL = {
  users: 'users',
  accounts: 'lc_accounts',
  stats: 'daily_stats',
  logs: 'sync_logs',
  invites: 'invites'
}

async function first(collection, where) {
  const res = await db.collection(collection).where(where).limit(1).get()
  return res.data[0] || null
}

async function all(collection, where, orderBy) {
  let query = db.collection(collection)
  if (where) query = query.where(where)
  if (orderBy) query = query.orderBy(orderBy.field, orderBy.order || 'asc')
  const res = await query.limit(1000).get()
  return res.data
}

async function upsert(collection, where, data) {
  const found = await first(collection, where)
  if (found) {
    await db.collection(collection).doc(found._id).update({ data })
    return { ...found, ...data }
  }
  const res = await db.collection(collection).add({ data: { ...where, ...data } })
  return { _id: res._id, ...where, ...data }
}

module.exports = { cloud, db, _, COL, first, all, upsert }

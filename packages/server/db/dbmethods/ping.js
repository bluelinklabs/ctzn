export default function (db, caller, args) {
  return {
    message: args?.message || 'Pong'
  }
}
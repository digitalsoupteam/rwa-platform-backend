# In-container part of the MongoDB replica set `rs0` initializer.
#
# Fed over stdin to a throwaway `mongo` container:
#   docker run --rm -i --network <network> mongo:latest bash -s < init-mongo-container.sh
#
# Shared by both host wrappers — `init-mongo-replicaset.sh` (git-bash / Linux)
# and `app-up.ts` (`bun run app:up`, works from any shell) — single source of
# truth for the set logic.
#
# Creates the set on the first run, adds missing members on later runs, and
# exits 0 as soon as the set reports READY.
#
# NOTE: keep the rs.status() calls INLINE — in mongosh 2.x an error inside an
# arrow-function wrapper escapes the surrounding try/catch (see the
# mongodb-replicaset-compose skill).

for i in $(seq 1 40); do
  mongosh --host mongodb --quiet --eval '
    try {
      const st = rs.status();
      const want = ["mongodb:27017", "mongodb-2:27017", "mongodb-3:27017"];
      const have = st.members.map(m => m.name);
      for (const w of want) { if (!have.includes(w)) { rs.add(w); print("ADDED " + w); } }
    } catch (e) {
      rs.initiate({ _id: "rs0", members: [
        { _id: 0, host: "mongodb:27017" },
        { _id: 1, host: "mongodb-2:27017" },
        { _id: 2, host: "mongodb-3:27017" }
      ]});
      print("INITIATED");
    }
  ' 2>/dev/null
  out=$(mongosh --host mongodb --quiet --eval '
    try { const s = rs.status(); print(s.ok === 1 && s.members.length >= 3 ? "READY" : "WAIT"); } catch (e) { print("WAIT"); }
  ' 2>/dev/null | tail -1)
  echo "mongo replica set attempt $i: $out"
  if [ "$out" = "READY" ]; then exit 0; fi
  sleep 3
done
exit 1

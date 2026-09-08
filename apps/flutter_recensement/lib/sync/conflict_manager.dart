/// Conflict resolution helpers for offline sync.
class ConflictManager {
  /// Server version wins when strictly greater; otherwise accept local write.
  static ConflictOutcome resolve({
    required int localVersion,
    required int serverVersion,
  }) {
    if (serverVersion > localVersion) {
      return ConflictOutcome.serverWins;
    }
    if (serverVersion < localVersion) {
      return ConflictOutcome.localWins;
    }
    return ConflictOutcome.sameVersion;
  }
}

enum ConflictOutcome { serverWins, localWins, sameVersion }

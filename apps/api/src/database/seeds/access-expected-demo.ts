import { DataSource } from 'typeorm';
export interface ExpectedDemoInput {
  adminId: number;
  scannerId: number;
  pointId: number;
  scanTypeId: number;
  sessionId: number;
  memberIds: number[];
  exceptionParticipantId: number;
  refusedEventId: number;
  acceptedEventId: number;
  now: Date;
}
/** Only called by the existing full fictitious-data reseed. Never adds to a live production dataset. */
export async function seedAccessExpectedDemo(ds: Pick<DataSource, 'query'>, x: ExpectedDemoInput) {
  const starts = new Date(x.now.getTime() - 3600000),
    ends = new Date(x.now.getTime() + 7 * 86400000);
  const [group] = await ds.query(
    `INSERT INTO access_expected_groups(name,created_by) VALUES($1,$2) RETURNING id`,
    ['QR-DEMO · Groupe attendu', x.adminId],
  );
  for (const participantId of x.memberIds)
    await ds.query(
      `INSERT INTO access_expected_group_sources(group_id,participant_id) VALUES($1,$2)`,
      [group.id, participantId],
    );
  const [passage] = await ds.query(
    `INSERT INTO access_expected_passages(group_id,point_id,scan_type_id,service_key,label,starts_at,ends_at,timezone,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,'Europe/Paris',$8) RETURNING id`,
    [
      group.id,
      x.pointId,
      x.scanTypeId,
      'qr-demo-groupe',
      'QR-DEMO · Passage test (7 jours)',
      starts,
      ends,
      x.adminId,
    ],
  );
  await ds.query(`UPDATE access_scan_points SET expected_online_required=true WHERE id=$1`, [
    x.pointId,
  ]);
  await ds.query(
    `INSERT INTO access_exception_grants(user_id,point_id,created_by,starts_at,ends_at) VALUES($1,$2,$3,$4,$5)`,
    [x.scannerId, x.pointId, x.adminId, starts, ends],
  );
  await ds.query(
    `INSERT INTO access_passage_exceptions(passage_id,participant_id,authorized_by,session_id,reason,created_at,refused_event_id,accepted_event_id,operation_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      passage.id,
      x.exceptionParticipantId,
      x.scannerId,
      x.sessionId,
      'DEMO : accompagne le groupe pour ce passage',
      x.now,
      x.refusedEventId,
      x.acceptedEventId,
      'qr-seed-exception-' + passage.id,
    ],
  );
  return { groupId: group.id, passageId: passage.id };
}

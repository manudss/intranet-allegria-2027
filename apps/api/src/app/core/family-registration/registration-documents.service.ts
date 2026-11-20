import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Participant, ParticipantRegistrationStatus } from '../entities';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { FamilyRegistrationService, digest } from './family-registration.service';
@Injectable()
export class RegistrationDocumentsService {
  constructor(
    private readonly db: DataSource,
    private readonly families: FamilyRegistrationService,
  ) {}
  async list(family: string, youth: string) {
    this.families.youth(await this.families.get(family), youth);
    return this.db.query(
      'SELECT id,name,mime,status,reason,"createdAt" FROM registration_documents WHERE family_id=$1 AND "youthId"=$2 ORDER BY "createdAt" DESC',
      [family, youth],
    );
  }
  private scan(content: Buffer) {
    return new Promise<void>((resolve, reject) => {
      const p = spawn('clamdscan', ['--stream', '--no-summary', '-'], {
        stdio: ['pipe', 'ignore', 'ignore'],
      });
      const timer = setTimeout(() => {
        p.kill();
        reject(
          new ServiceUnavailableException('Analyse du fichier indisponible. Réessayez plus tard.'),
        );
      }, 15000);
      p.on('error', () => {
        clearTimeout(timer);
        reject(
          new ServiceUnavailableException(
            'La vérification antivirus des pièces n’est pas encore disponible. Aucun fichier conservé.',
          ),
        );
      });
      p.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else
          reject(
            new BadRequestException(
              'Pièce refusée ou analyse indisponible. Aucun fichier conservé.',
            ),
          );
      });
      p.stdin.on('error', () => {
        /* Process close/error supplies the fail-closed outcome. */
      });
      p.stdin.end(content);
    });
  }
  async upload(family: string, youth: string, file: { buffer: Buffer; originalname: string }) {
    const s = await this.families.get(family);
    this.families.editable(this.families.youth(s, youth));
    if (!file?.buffer || file.buffer.length > 2 * 1024 * 1024)
      throw new BadRequestException('Fichier PDF, PNG ou JPEG, 2 Mo maximum.');
    const b = file.buffer,
      mime =
        b.subarray(0, 5).toString() === '%PDF-'
          ? 'application/pdf'
          : b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            ? 'image/png'
            : b[0] === 255 && b[1] === 216
              ? 'image/jpeg'
              : null;
    if (!mime) throw new BadRequestException('Type de fichier refusé');
    await this.scan(b);
    const id = randomUUID(),
      name = file.originalname.replace(/[^\p{L}\p{N} ._-]/gu, '').slice(0, 150) || 'document';
    await this.db.transaction(async (m) => {
      const [fresh] = await m.query(
        'SELECT dossier FROM registration_families WHERE id=$1 FOR UPDATE',
        [family],
      );
      this.families.editable(this.families.youth(fresh.dossier, youth));
      const [{ n }] = await m.query(
        'SELECT count(*)::int AS n FROM registration_documents WHERE family_id=$1 AND "youthId"=$2',
        [family, youth],
      );
      if (n >= 20)
        throw new BadRequestException(
          'Vingt pièces maximum par jeune. Contactez l’organisation avant un nouveau dépôt.',
        );

      await m.query(
        'INSERT INTO registration_documents(id,family_id,"youthId",name,mime,content,digest) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [id, family, youth, name, mime, b, digest(b)],
      );
    });
    return this.list(family, youth);
  }
  async download(family: string, youth: string, id: string) {
    this.families.youth(await this.families.get(family), youth);
    const [d] = await this.db.query(
      'SELECT name,mime,content FROM registration_documents WHERE id=$1 AND family_id=$2 AND "youthId"=$3',
      [id, family, youth],
    );
    if (!d) throw new BadRequestException('Pièce introuvable');
    return d;
  }
  async staffReview(
    family: string,
    youth: string,
    id: string,
    status: unknown,
    reason: unknown,
    actor: string,
  ) {
    if (
      !['RECEIVED', 'ACCEPTED', 'CORRECTION'].includes(String(status)) ||
      typeof reason !== 'string' ||
      reason.length > 500 ||
      (status === 'CORRECTION' && !reason.trim())
    )
      throw new BadRequestException('Statut et motif administratif requis');
    await this.db.transaction(async (m) => {
      const [f] = await m.query(
        'SELECT dossier FROM registration_families WHERE id=$1 FOR UPDATE',
        [family],
      );
      if (!f) throw new BadRequestException('Dossier introuvable');
      const y = this.families.youth(f.dossier, youth);
      const [doc] = await m.query(
        'UPDATE registration_documents SET status=$1,reason=$2 WHERE id=$3 AND family_id=$4 AND "youthId"=$5 RETURNING id',
        [status, reason, id, family, youth],
      );
      if (!doc) throw new BadRequestException('Pièce introuvable');
      if (status === 'CORRECTION') {
        y.state = 'CORRECTION';
        if (y.participantId)
          await m
            .getRepository(Participant)
            .update(y.participantId, { status: ParticipantRegistrationStatus.PENDING });
        y.correction = 'Pièce administrative à corriger : ' + reason;
        f.dossier.revision++;
        f.dossier.updatedAt = new Date().toISOString();
        await m.query('UPDATE registration_families SET dossier=$1,"updatedAt"=now() WHERE id=$2', [
          f.dossier,
          family,
        ]);
      }

      await m.query(
        `INSERT INTO registration_audit(family_id,"youthId",action,actor) VALUES($1,$2,'DOCUMENT_REVIEWED',$3)`,
        [family, youth, actor],
      );
    });
    return this.list(family, youth);
  }
  async staffDownload(family: string, youth: string, id: string, actor: string) {
    const d = await this.download(family, youth, id);
    await this.db.query(
      `INSERT INTO registration_audit(family_id,"youthId",action,actor) VALUES($1,$2,'DOCUMENT_READ',$3)`,
      [family, youth, actor],
    );
    return d;
  }
}

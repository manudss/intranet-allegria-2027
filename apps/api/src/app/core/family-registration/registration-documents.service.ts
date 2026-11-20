import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
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
      p.stdin.on('error', () => { /* Process close/error supplies the fail-closed outcome. */ });
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
          : b[0] === 137 && b.subarray(1, 4).toString() === 'PNG'
            ? 'image/png'
            : b[0] === 255 && b[1] === 216
              ? 'image/jpeg'
              : null;
    if (!mime) throw new BadRequestException('Type de fichier refusé');
    await this.scan(b);
    const id = randomUUID(),
      name = file.originalname.replace(/[^\p{L}\p{N} ._-]/gu, '').slice(0, 150) || 'document';
    await this.db.query(
      'INSERT INTO registration_documents(id,family_id,"youthId",name,mime,content,digest) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [id, family, youth, name, mime, b, digest(b)],
    );
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
}

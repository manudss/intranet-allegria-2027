import { authorizationPdf } from './signature-pdf';
import { signatureAppearance } from './signature-code';
import { UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RegistrationDocumentsService } from './registration-documents.service';
import { UseInterceptors } from '@nestjs/common';
import { PrivateResponseInterceptor } from './private-response.interceptor';
import { RegistrationHealthService } from './registration-health.service';
import { healthPdf } from './health-pdf';
import { registrationPdf } from './registration-pdf';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.decorator';
import { RoleGuard } from '../auth/role.guard';
import { FamilyRegistrationService, plainObject } from './family-registration.service';
import type { Request, Response } from 'express';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
const token = (r: Request) =>
  String(r.headers.cookie || '')
    .split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith('alegria_family='))
    ?.slice(15) || '';
function revision(p: Record<string, unknown>) {
  if (!Number.isInteger(p.revision) || Number(p.revision) < 0)
    throw new BadRequestException('Révision requise');
  return Number(p.revision);
}
/** Family sessions are separate from staff bearer tokens. Every owner lookup is server-side. */
@Public()
@UseGuards(ThrottlerGuard)
// Explicit policy: the legacy public module also registers global throttler options (5/10min).
@Throttle({ default: { limit: 120, ttl: 60000 } })
@UseInterceptors(PrivateResponseInterceptor)
@Controller('public/family-space')
export class FamilyRegistrationController {
  constructor(
    private readonly service: FamilyRegistrationService,
    private readonly health: RegistrationHealthService,
    private readonly documents: RegistrationDocumentsService,
  ) {}
  private checkOrigin(r: Request) {
    const origin = r.headers.origin;
    if (!origin) throw new ForbiddenException('Origine requise');
    try {
      const url = new URL(origin);
      if (
        url.host !== r.get('host') &&
        !String(process.env.CORS_ORIGIN || '')
          .split(',')
          .includes(origin)
      )
        throw new Error();
    } catch {
      throw new ForbiddenException('Origine refusée');
    }
  }
  private async owner(r: Request, write = false) {
    if (write) this.checkOrigin(r);
    return this.service.session(token(r));
  }
  @Get('rules') rules() {
    return this.service.rules();
  }
  @Throttle({ default: { limit: 5, ttl: 600000 } })
  @Post('access')
  access(@Req() r: Request, @Body() raw: unknown) {
    this.checkOrigin(r);
    return this.service.challenge(plainObject(raw).email);
  }
  @Throttle({ default: { limit: 20, ttl: 600000 } })
  @Post('verify')
  async verify(@Req() r: Request, @Body() raw: unknown, @Res({ passthrough: true }) res: Response) {
    this.checkOrigin(r);
    const p = plainObject(raw),
      result = await this.service.verify(String(p.challengeId || ''), String(p.code || ''));
    res.cookie('alegria_family', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/api/public/family-space',
    });
    res.setHeader('Cache-Control', 'no-store');
    return this.service.get(result.familyId);
  }
  @Throttle({ default: { limit: 10, ttl: 600000 } })
  @Post('preview-demo')
  async previewDemo(
    @Req() r: Request,
    @Body() raw: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.checkOrigin(r);
    if (Object.keys(plainObject(raw)).length)
      throw new BadRequestException('La famille fictive ne peut pas être changée');
    const result = await this.service.previewSession();
    res.cookie('alegria_family', result.token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 4 * 60 * 60 * 1000,
      path: '/api/public/family-space',
    });
    res.setHeader('Cache-Control', 'no-store');
    return this.service.get(result.familyId);
  }
  @Get() async get(@Req() r: Request, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    return this.service.get(await this.owner(r));
  }
  @Delete('session') async logout(@Req() r: Request, @Res({ passthrough: true }) res: Response) {
    this.checkOrigin(r);
    await this.service.logout(token(r));
    res.clearCookie('alegria_family', { path: '/api/public/family-space' });
    return { ok: true };
  }
  @Post('youths') async add(@Req() r: Request, @Body() raw: unknown) {
    return this.service.add(await this.owner(r, true), revision(plainObject(raw)));
  }
  @Patch('contact') async contact(@Req() r: Request, @Body() raw: unknown) {
    const p = plainObject(raw);
    return this.service.saveContact(await this.owner(r, true), revision(p), p.contact);
  }
  @Patch('youths/:id') async save(
    @Req() r: Request,
    @Param('id') id: string,
    @Body() raw: unknown,
  ) {
    const p = plainObject(raw);
    return this.service.saveYouth(await this.owner(r, true), id, revision(p), p.patch);
  }
  @Post('youths/:id/signatures') async sign(
    @Req() r: Request,
    @Param('id') id: string,
    @Body() raw: unknown,
  ) {
    const p = plainObject(raw);
    return this.service.sign(await this.owner(r, true), id, revision(p), p);
  }
  @Post('youths/:id/signatures/code') async signatureCode(
    @Req() r: Request,
    @Param('id') id: string,
    @Body() raw: unknown,
  ) {
    const p = plainObject(raw);
    return this.service.requestSignatureCode(await this.owner(r, true), id, revision(p), p);
  }
  @Get('youths/:id/documents') async documentList(@Req() r: Request, @Param('id') id: string) {
    return this.documents.list(await this.owner(r), id);
  }
  @Post('youths/:id/documents')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024, files: 1 } }))
  async documentUpload(
    @Req() r: Request,
    @Param('id') id: string,
    @UploadedFile() file: { buffer: Buffer; originalname: string },
  ) {
    return this.documents.upload(await this.owner(r, true), id, file);
  }
  @Get('youths/:id/documents/:documentId') async documentDownload(
    @Req() r: Request,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Res() res: Response,
  ) {
    const d = await this.documents.download(await this.owner(r), id, documentId);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', d.mime);
    res.setHeader('Content-Disposition', 'attachment; filename="document"');
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
    res.send(d.content);
  }
  @Get('youths/:id/health/declaration') async healthDeclaration(
    @Req() r: Request,
    @Param('id') id: string,
  ) {
    this.service.youth(await this.service.get(await this.owner(r)), id);
    return this.health.declaration();
  }
  @Get('youths/:id/health') async healthGet(@Req() r: Request, @Param('id') id: string) {
    return this.health.get(await this.owner(r), id);
  }
  @Patch('youths/:id/health') async healthSave(
    @Req() r: Request,
    @Param('id') id: string,
    @Body() raw: unknown,
  ) {
    const p = plainObject(raw);
    return this.health.save(await this.owner(r, true), id, revision(p), p.health);
  }
  @Post('youths/:id/health/sign') async healthSign(
    @Req() r: Request,
    @Param('id') id: string,
    @Body() raw: unknown,
  ) {
    const p = plainObject(raw);
    return this.health.sign(await this.owner(r, true), id, revision(p), p);
  }
  @Post('youths/:id/health/sign/code') async healthSignatureCode(
    @Req() r: Request,
    @Param('id') id: string,
    @Body() raw: unknown,
  ) {
    const p = plainObject(raw);
    return this.health.requestCode(await this.owner(r, true), id, revision(p), p);
  }
  @Post('youths/:id/health/preview') async healthPreview(
    @Req() r: Request,
    @Param('id') id: string,
    @Body() raw: unknown,
    @Res() res: Response,
  ) {
    const p = plainObject(raw),
      familyId = await this.owner(r, true);
    const bytes = await this.health.preview(familyId, id, p.health, p.signature);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/pdf');
    res.send(Buffer.from(bytes));
  }
  @Post('youths/:id/templates/:templateId/preview') async authorizationPreview(
    @Req() r: Request,
    @Param('id') id: string,
    @Param('templateId') templateId: string,
    @Body() raw: unknown,
    @Res() res: Response,
  ) {
    const family = await this.service.get(await this.owner(r, true)),
      youth = this.service.youth(family, id),
      p = plainObject(raw);
    const template = (await this.service.rules()).templates.find(
      (t) => t.id === templateId && t.enabled,
    );
    if (!template) throw new BadRequestException('Modèle indisponible');
    const planned = p.appearance
      ? {
          name: String(p.name || '').slice(0, 180),
          appearance: await signatureAppearance(p.appearance),
        }
      : undefined;
    const bytes = await authorizationPdf(
      JSON.stringify({ template, identity: youth.identity }),
      undefined,
      planned,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/pdf');
    res.send(Buffer.from(bytes));
  }
  @Get('youths/:id/health/pdf') async healthPdf(
    @Req() r: Request,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const bytes = await this.health.pdf(await this.owner(r), id);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="fiche-sanitaire.pdf"');
    res.send(Buffer.from(bytes));
  }
  @Get('youths/:id/templates/:templateId/pdf')
  async unsignedPdf(
    @Req() r: Request,
    @Param('id') id: string,
    @Param('templateId') templateId: string,
    @Res() res: Response,
  ) {
    const family = await this.service.get(await this.owner(r));
    const youth = this.service.youth(family, id);
    const template = (await this.service.rules()).templates.find(
      (t) => t.id === templateId && t.enabled,
    );
    if (!template) throw new BadRequestException('Modèle indisponible');
    const bytes = await registrationPdf([
      template.title,
      'Version ' + template.version,
      'Jeune : ' + youth.identity.firstName + ' ' + youth.identity.lastName,
      ...template.text.split('\n'),
      'DOCUMENT SANS ATTESTATION',
      'Ce téléchargement ne signe pas le document. Une signature externe doit être vérifiée séparément.',
    ]);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="document-a-signer.pdf"');
    res.send(Buffer.from(bytes));
  }
  @Get('youths/:id/signatures/:index/pdf')
  async signedPdf(
    @Req() r: Request,
    @Param('id') id: string,
    @Param('index') index: string,
    @Res() res: Response,
  ) {
    const family = await this.service.get(await this.owner(r));
    const youth = this.service.youth(family, id);
    const signature = youth.signatures[Number(index)];
    if (!signature?.snapshot) throw new BadRequestException('Document indisponible');
    const bytes = await authorizationPdf(signature.snapshot, signature);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="autorisation.pdf"');
    res.send(Buffer.from(bytes));
  }
  @Post('youths/:id/submit') async submit(
    @Req() r: Request,
    @Param('id') id: string,
    @Body() raw: unknown,
  ) {
    const p = plainObject(raw);
    return this.service.submit(await this.owner(r, true), id, revision(p), p.accepted);
  }
}
@UseInterceptors(PrivateResponseInterceptor)
@Controller('family-registrations')
@UseGuards(RoleGuard)
@Roles('ADMIN', 'COORDINATOR')
export class FamilyRegistrationStaffController {
  constructor(
    private readonly service: FamilyRegistrationService,
    private readonly documents: RegistrationDocumentsService,
  ) {}
  @Get() list() {
    return this.service.list();
  }
  @Get(':family/youths/:youth/documents') documentsList(
    @Param('family') family: string,
    @Param('youth') youth: string,
  ) {
    return this.documents.list(family, youth);
  }
  @Patch(':family/youths/:youth/documents/:document') reviewDocument(
    @Param('family') family: string,
    @Param('youth') youth: string,
    @Param('document') document: string,
    @Body() raw: unknown,
    @Req() r: Request & { user: { email: string } },
  ) {
    const p = plainObject(raw);
    return this.documents.staffReview(family, youth, document, p.status, p.reason, r.user.email);
  }
  @Get(':family/youths/:youth/documents/:document') async downloadDocument(
    @Param('family') family: string,
    @Param('youth') youth: string,
    @Param('document') document: string,
    @Req() r: Request & { user: { email: string } },
    @Res() res: Response,
  ) {
    const d = await this.documents.staffDownload(family, youth, document, r.user.email);
    res.setHeader('Content-Type', d.mime);
    res.setHeader('Content-Disposition', 'attachment; filename="piece-administrative"');
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
    res.send(d.content);
  }

  @Get('rules') rules() {
    return this.service.rules();
  }
  @Patch('rules') @Roles('ADMIN') configure(@Body() p: unknown) {
    return this.service.configure(p);
  }
  @Post(':id/youths/:youthId/review') review(
    @Param('id') id: string,
    @Param('youthId') youthId: string,
    @Body() raw: unknown,
    @Req() req: Request & { user: { email: string } },
  ) {
    const p = plainObject(raw);
    return this.service.review(id, youthId, revision(p), p.state, p.reason, req.user.email);
  }
}

@Controller('catering-needs')
@UseGuards(RoleGuard)
@Roles('CATERING')
export class CateringNeedsController {
  constructor(private readonly health: RegistrationHealthService) {}
  @Get() async list(@Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    return this.health.catering();
  }
}

@UseInterceptors(PrivateResponseInterceptor)
@UseGuards(RoleGuard)
@Roles('HEALTH')
@Controller('family-health')
export class FamilyHealthStaffController {
  constructor(
    private readonly health: RegistrationHealthService,
    private readonly families: FamilyRegistrationService,
  ) {}
  @Get() list() {
    return this.health.staffList();
  }
  @Get(':family/youths/:youth') read(
    @Param('family') family: string,
    @Param('youth') youth: string,
    @Req() r: Request & { user: { email: string } },
  ) {
    return this.health.staffRead(family, youth, r.user.email);
  }
  @Get(':family/youths/:youth/pdf') async pdf(
    @Param('family') family: string,
    @Param('youth') youth: string,
    @Req() r: Request & { user: { email: string } },
    @Res() res: Response,
  ) {
    const data = await this.health.staffRead(family, youth, r.user.email);
    const f = await this.families.get(family);
    const bytes = await healthPdf(
      { ...f, contact: data.contact },
      this.families.youth(f, youth),
      data.health,
      this.health.declaration().text || '',
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="fiche-sanitaire.pdf"');
    res.send(Buffer.from(bytes));
  }
}

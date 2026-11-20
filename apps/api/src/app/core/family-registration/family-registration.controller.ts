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
@UseInterceptors(PrivateResponseInterceptor)
@Controller('public/family-space')
export class FamilyRegistrationController {
  constructor(
    private readonly service: FamilyRegistrationService,
    private readonly health: RegistrationHealthService,
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
  @Get('youths/:id/health/pdf') async healthPdf(
    @Req() r: Request,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const familyId = await this.owner(r),
      family = await this.service.get(familyId),
      y = this.service.youth(family, id),
      h = await this.health.get(familyId, id);
    const bytes = await healthPdf(
      family,
      y,
      h,
      String(process.env.FAMILY_HEALTH_DECLARATION_TEXT || 'Déclaration non configurée'),
    );
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="fiche-sanitaire.pdf"');
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
    const snap = JSON.parse(signature.snapshot);
    const bytes = await registrationPdf([
      snap.template.title,
      'Version ' + signature.version,
      'Jeune : ' + snap.identity.firstName + ' ' + snap.identity.lastName,
      ...String(snap.template.text).split('\n'),
      'Attestation simple (non qualifiée)',
      'Signataire : ' + signature.signerName,
      'Qualité : ' + signature.capacity,
      'Date : ' + signature.signedAt,
      'Empreinte SHA-256 du contenu figé : ' + signature.digest,
      signature.withdrawnAt
        ? 'Remplacée / retirée le ' + signature.withdrawnAt
        : 'Attestation enregistrée',
    ]);
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
  constructor(private readonly service: FamilyRegistrationService) {}
  @Get() list() {
    return this.service.list();
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
  ) {
    const p = plainObject(raw);
    return this.service.review(id, youthId, revision(p), p.state, p.reason);
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

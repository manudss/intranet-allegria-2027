package fr.allegria.signatures;

import java.io.*;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.KeyStore.PasswordProtection;
import java.util.*;
import eu.europa.esig.dss.enumerations.*;
import eu.europa.esig.dss.model.*;
import eu.europa.esig.dss.signature.*;
import eu.europa.esig.dss.spi.validation.CommonCertificateVerifier;
import eu.europa.esig.dss.validation.SignedDocumentValidator;
import eu.europa.esig.dss.token.*;
import eu.europa.esig.dss.pades.*;
import eu.europa.esig.dss.pades.signature.PAdESService;
import eu.europa.esig.dss.xades.*;
import eu.europa.esig.dss.xades.signature.XAdESService;
import eu.europa.esig.dss.cades.*;
import eu.europa.esig.dss.cades.signature.CAdESService;
import eu.europa.esig.dss.jades.*;
import eu.europa.esig.dss.jades.signature.JAdESService;

/** Local operator tool, never creates a parent identity or trusts a certificate by default. */
public final class DocumentSignatures {
  private DocumentSignatures() {}
  public static void main(String[] args) throws Exception {
    if (args.length == 2 && args[0].equals("verify")) { verify(input(args[1])); return; }
    if (args.length != 4 || !args[0].equals("sign"))
      throw new IllegalArgumentException("sign PADES|XADES|CADES|JADES input output; or verify signed-file. Local operator only, no identity validation.");
    String format = args[1].toUpperCase(Locale.ROOT);
    if (!Set.of("PADES", "XADES", "CADES", "JADES").contains(format)) throw new IllegalArgumentException("Unsupported format");
    DSSDocument source = input(args[2]);
    Path output = Path.of(args[3]);
    if (Files.exists(output)) throw new IllegalArgumentException("Refusing to overwrite an existing file");
    String bundle = requiredEnv("ALLEGRIA_SIGN_P12_FILE");
    Path passPath = Path.of(requiredEnv("ALLEGRIA_SIGN_PASSWORD_FILE"));
    if (Files.size(passPath) > 4096) throw new IllegalArgumentException("Invalid password file");
    char[] password = Files.readString(passPath).toCharArray();
    PasswordProtection protection = new PasswordProtection(password);
    Arrays.fill(password, '\0');
    try (Pkcs12SignatureToken token = new Pkcs12SignatureToken(bundle, protection)) {
      List<DSSPrivateKeyEntry> keys = token.getKeys();
      if (keys.size() != 1) throw new IllegalArgumentException("Exactly one key required. Select a dedicated certificate bundle explicitly.");
      DSSPrivateKeyEntry key = keys.get(0);
      CommonCertificateVerifier verifier = new CommonCertificateVerifier(true);
      DSSDocument signed;
      switch (format) {
        case "PADES": signed = sign(new PAdESService(verifier), new PAdESSignatureParameters(), SignatureLevel.PAdES_BASELINE_B, SignaturePackaging.ENVELOPED, source, token, key); break;
        case "XADES": signed = sign(new XAdESService(verifier), new XAdESSignatureParameters(), SignatureLevel.XAdES_BASELINE_B, SignaturePackaging.ENVELOPED, source, token, key); break;
        case "CADES": signed = sign(new CAdESService(verifier), new CAdESSignatureParameters(), SignatureLevel.CAdES_BASELINE_B, SignaturePackaging.ENVELOPING, source, token, key); break;
        default: signed = sign(new JAdESService(verifier), new JAdESSignatureParameters(), SignatureLevel.JAdES_BASELINE_B, SignaturePackaging.ENVELOPING, source, token, key);
      }
      Files.createFile(output, PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")));
      try (OutputStream stream = Files.newOutputStream(output)) { signed.writeTo(stream); }
      catch (Exception e) { Files.deleteIfExists(output); throw e; }
      System.out.println("{\"created\":true,\"profile\":\"" + format + "_BASELINE_B\",\"identityValidated\":false,\"qualifiedSignature\":false}");
    } finally { protection.destroy(); }
  }
  private static DSSDocument input(String name) throws IOException {
    Path path = Path.of(name);
    if (!Files.isRegularFile(path) || Files.size(path) > 10 * 1024 * 1024) throw new IllegalArgumentException("A regular input file up to 10 MiB is required");
    return new FileDocument(path.toFile());
  }
  private static String requiredEnv(String key) {
    String value = System.getenv(key);
    if (value == null || value.isBlank()) throw new IllegalArgumentException("Missing local file setting: " + key);
    return value;
  }
  private static <TP extends SerializableTimestampParameters, SP extends AbstractSignatureParameters<?>> DSSDocument sign(
      DocumentSignatureService<SP, TP> service, SP parameters, SignatureLevel level, SignaturePackaging packaging,
      DSSDocument source, Pkcs12SignatureToken token, DSSPrivateKeyEntry key) {
    parameters.setSigningCertificate(key.getCertificate());
    parameters.setCertificateChain(key.getCertificateChain());
    parameters.setDigestAlgorithm(DigestAlgorithm.SHA256);
    parameters.setSignatureLevel(level);
    parameters.setSignaturePackaging(packaging);
    ToBeSigned content = service.getDataToSign(source, parameters);
    SignatureValue value = token.sign(content, DigestAlgorithm.SHA256, key);
    return service.signDocument(source, parameters, value);
  }
  private static void verify(DSSDocument document) {
    SignedDocumentValidator validator = SignedDocumentValidator.fromDocument(document);
    // No HTTP AIA, revocation or timestamp lookup. No external health disclosure.
    validator.setCertificateVerifier(new CommonCertificateVerifier(true));
    var signatures = validator.getSignatures();
    boolean valid = !signatures.isEmpty();
    for (var signature : signatures) {
      signature.checkSignatureIntegrity();
      valid &= signature.getSignatureCryptographicVerification().isSignatureValid();
    }
    System.out.println("{\"signatures\":" + signatures.size() + ",\"cryptographicIntegrity\":" + valid + ",\"certificateTrust\":\"NOT_EVALUATED\",\"revocation\":\"NOT_CHECKED\",\"qualifiedStatus\":\"NOT_EVALUATED\"}");
    if (!valid) throw new IllegalArgumentException("No intact cryptographic signature found");
  }
}

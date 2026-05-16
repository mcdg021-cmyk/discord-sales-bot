import Tesseract from 'tesseract.js';
import { createHash } from 'crypto';
import sharp from 'sharp';
import { PaymentModel } from '../../models/Payment.model';
import type { IOCRResult } from '../../shared/types';
import { logger } from '../../utils/logger';

const CONFIDENCE_THRESHOLD = Number(process.env.OCR_CONFIDENCE_THRESHOLD ?? 60);

export class OCRService {
  /**
   * Calcula hash SHA-256 da imagem (para detectar duplicatas).
   */
  static async hashImage(buffer: Buffer): Promise<string> {
    const normalized = await sharp(buffer).resize(512).grayscale().toBuffer();
    return createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Extrai texto do comprovante usando Tesseract.js.
   */
  static async extractText(buffer: Buffer): Promise<{ text: string; confidence: number }> {
    const lang = process.env.TESSERACT_LANG ?? 'por';
    const {
      data: { text, confidence },
    } = await Tesseract.recognize(buffer, lang, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          logger.debug(`OCR progresso: ${Math.round(m.progress * 100)}%`);
        }
      },
    });
    return { text: text.trim(), confidence };
  }

  /**
   * Analisa o texto do comprovante e extrai campos relevantes.
   */
  static parseProofText(text: string): Partial<IOCRResult> {
    const normalized = text.toLowerCase().replace(/\s+/g, ' ');

    // Valor: R$ 10,00 | R$10.00 | 10,00
    const amountMatch = normalized.match(/r\$\s*(\d{1,6}[.,]\d{2})/);
    const amount = amountMatch
      ? parseFloat(amountMatch[1].replace(',', '.'))
      : undefined;

    // Data: DD/MM/YYYY ou DD/MM/YY
    const dateMatch = normalized.match(/(\d{2}\/\d{2}\/\d{2,4})/);
    const date = dateMatch?.[1];

    // Hora: HH:MM ou HH:MM:SS
    const timeMatch = normalized.match(/(\d{2}:\d{2}(?::\d{2})?)/);
    const time = timeMatch?.[1];

    // Nome do destinatário (após "para:" ou "destinatário:")
    const recipientMatch = normalized.match(/(?:para:|destinat[aá]rio:?)\s*([a-záàâãéêíóôõúç ]{3,40})/i);
    const recipientName = recipientMatch?.[1]?.trim();

    // Chave Pix mencionada
    const pixKeyMatch = normalized.match(/chave[:\s]+([^\s]{5,100})/i);
    const pixKey = pixKeyMatch?.[1];

    // Banco
    const bankNames = ['nubank', 'itaú', 'itau', 'bradesco', 'santander', 'caixa', 'inter', 'c6', 'sicoob', 'pagbank'];
    const bank = bankNames.find((b) => normalized.includes(b));

    return { amount, date, time, recipientName, pixKey, bank };
  }

  /**
   * Verifica o comprovante contra os dados do pagamento esperado.
   */
  static async verifyProof(
    imageBuffer: Buffer,
    expectedAmount: number,
    expectedPixKey: string,
    paymentId: string,
  ): Promise<IOCRResult> {
    const failReasons: string[] = [];

    // 1. Hash para detectar duplicatas
    const hash = await this.hashImage(imageBuffer);
    const duplicate = await PaymentModel.findOne({
      _id: { $ne: paymentId },
      proofImageHash: hash,
      status: { $in: ['confirmed'] },
    });
    if (duplicate) {
      failReasons.push('Comprovante já utilizado em outro pedido.');
    }

    // 2. OCR
    let text = '';
    let confidence = 0;
    try {
      const result = await this.extractText(imageBuffer);
      text = result.text;
      confidence = result.confidence;
    } catch (err) {
      logger.error('Erro no OCR', { err });
      failReasons.push('Não foi possível processar a imagem.');
    }

    if (confidence < CONFIDENCE_THRESHOLD) {
      failReasons.push(`Qualidade da imagem insuficiente (confiança: ${Math.round(confidence)}%).`);
    }

    const parsed = this.parseProofText(text);

    // 3. Verificar valor
    if (parsed.amount !== undefined) {
      const diff = Math.abs(parsed.amount - expectedAmount);
      if (diff > 0.01) {
        failReasons.push(
          `Valor incorreto no comprovante: R$ ${parsed.amount?.toFixed(2)} (esperado: R$ ${expectedAmount.toFixed(2)}).`,
        );
      }
    } else {
      failReasons.push('Valor não encontrado no comprovante.');
    }

    // 4. Verificar data (não pode ser de mais de 24h atrás)
    if (parsed.date) {
      const [day, month, year] = parsed.date.split('/').map(Number);
      const fullYear = year < 100 ? 2000 + year : year;
      const proofDate = new Date(fullYear, month - 1, day);
      const diff = Date.now() - proofDate.getTime();
      if (diff > 24 * 60 * 60 * 1000) {
        failReasons.push('Comprovante com data anterior a 24 horas.');
      }
    }

    const passed = failReasons.length === 0 && confidence >= CONFIDENCE_THRESHOLD;

    const ocrResult: IOCRResult = {
      text,
      confidence,
      passed,
      failReasons,
      ...parsed,
    };

    // Salvar resultado no pagamento
    await PaymentModel.findByIdAndUpdate(paymentId, {
      proofImageHash: hash,
      ocrData: ocrResult,
    });

    return ocrResult;
  }
}

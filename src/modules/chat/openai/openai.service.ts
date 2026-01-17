import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

/**
 * ✅ OpenAiService
 * Responsabilidad única (SRP):
 * - Hablar con OpenAI y devolver un texto de respuesta.
 *
 * IMPORTANTE:
 * - La API Key vive SOLO en backend (seguridad).
 */
@Injectable()
export class OpenAiService {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('❌ Falta la variable OPENAI_API_KEY en el .env');
    }

    this.client = new OpenAI({ apiKey });

    // ✅ Modelo por defecto
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  }

  /**
   * ✅ Genera respuesta del asistente
   * @param system instrucciones del rol del asistente
   * @param historyText historial resumido en texto
   * @param userText mensaje actual del usuario
   */
  async reply(params: { system: string; historyText: string; userText: string }): Promise<string> {
    const input = `${params.historyText}\n\nUsuario: ${params.userText}`;

    const resp = await this.client.responses.create({
      model: this.model,
      instructions: params.system,
      input,
      truncation: 'auto',
      temperature: 0.6,
    });

    // ✅ output_text viene ya “plano”
    return resp.output_text?.trim() || 'No pude generar respuesta en este momento.';
  }
}

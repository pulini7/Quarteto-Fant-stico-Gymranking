import { GoogleGenAI } from "@google/genai";
import { User } from '../types';

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found");
  }
  return new GoogleGenAI({ apiKey });
};

export const getCoachMessage = async (user: User): Promise<string> => {
  try {
    const ai = getAiClient();
    
    // Check if user has weekend workouts
    const weekendWorkouts = user.checkIns.filter(c => {
        const d = new Date(`${c.date}T12:00:00`);
        const day = d.getDay();
        return day === 0 || day === 6;
    }).length;

    const prompt = `
      Você é um treinador de academia intenso, motivador, mas engraçado (estilo sargento durão mas carismático).
      O usuário se chama ${user.name} e faz parte do grupo de amigas "Quarteto Fantástico".
      
      Estatísticas:
      - Total Treinos: ${user.checkIns.length}
      - Streak Atual: ${user.streak} dias
      - Pontos (XP): ${user.score || 0}
      - Treinos em Fim de Semana (Sáb/Dom): ${weekendWorkouts}
      
      Regras de Resposta:
      - Responda em Português do Brasil.
      - Máximo 2 frases curtas.
      - Se ela tiver treinos no fim de semana (${weekendWorkouts} > 0), ELOGIE ISSO ESPECIFICAMENTE! Diga que ela é diferenciada por treinar no fds.
      - Se o streak for alto (> 3), diga que ela está vencendo as outras.
      - Se for baixo, cobre disciplina.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Vamos treinar! Sem desculpas hoje!";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "O treinador está descansando, mas você não deveria! Vá treinar!";
  }
};

export const generateAvatarImage = async (prompt: string): Promise<string | null> => {
  try {
    const ai = getAiClient();
    
    const refinedPrompt = `Avatar style, centered, round framing, high quality: ${prompt}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: refinedPrompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    // Iterate through parts to find the image
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
           return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error("Gemini Image Gen Error:", error);
    throw error;
  }
};
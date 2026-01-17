import { GoogleGenAI, Chat } from "@google/genai";
import { User } from '../types';

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found");
  }
  return new GoogleGenAI({ apiKey });
};

// Lista de tópicos para garantir que o coach não fale sempre a mesma coisa
const COACH_TOPICS = [
  "Hidratação intra-treino", "Sono anabólico", "Proteína em todas as refeições", "Agachamento profundo",
  "Execução lenta e controlada", "Conexão mente-músculo", "Não pular o treino de perna", "Cardio pós-treino",
  "Uso correto da Creatina", "Evitar açúcar refinado", "Disciplina vs Motivação", "Descanso entre séries",
  "Guardar os pesos no lugar", "Não usar celular no aparelho", "Amplitude de movimento total", "Progressão de carga inteligente",
  "Aquecimento de manguito rotador", "Alongamento apenas pós-treino", "Comer vegetais e fibras", "Álcool atrapalha a testosterona",
  "Foco total no exercício", "Respiração correta durante a força", "Tênis adequado (sola reta)", "Roupa confortável", "Garrafa d'água cheia",
  "Parceiro de treino que ajuda", "Regularidade é rainha", "Paciência com o processo", "Constância vence intensidade", "Não se comparar com instagram",
  "Espelho é ferramenta de correção", "Chegar até a falha muscular", "Técnica de Drop-set", "Técnica de Bi-set", "Evitar treino fofo",
  "Cara feia no treino é normal", "Suor é gordura chorando", "Dores tardias (DMT)", "Recuperação ativa", "Massagem e liberação miofascial",
  "Suplementação básica", "Pré-treino natural (café)", "Jantar leve", "Café da manhã de campeão", "Mobilidade de quadril",
  "Fortalecimento de core", "Postura no dia a dia", "Evitar overtraining", "Periodização de treino", "Deload week"
];

// Mantém a função antiga para compatibilidade se necessário, mas o chat é o foco agora
export const getCoachMessage = async (user: User): Promise<string> => {
  try {
    const ai = getAiClient();
    const prompt = `Dê uma dica curta e motivadora de treino para ${user.name}.`;
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Vá treinar!";
  } catch (error) {
    return "Foco no treino!";
  }
};

export const createCoachSession = (user: User): Chat => {
  const ai = getAiClient();
  
  const weekendWorkouts = user.checkIns.filter(c => {
      const d = new Date(`${c.date}T12:00:00`);
      const day = d.getDay();
      return day === 0 || day === 6;
  }).length;

  const systemInstruction = `
    Você é o "Sargento Músculo" (ou Coach Quarteto), o melhor Personal Trainer do mundo e especialista absoluto em fitness, musculação, nutrição esportiva e fisiologia.
    
    PERFIL DO ALUNO:
    - Nome: ${user.name}
    - Streak Atual: ${user.streak} dias
    - Total de Treinos: ${user.checkIns.length}
    - Treinos em Fim de Semana: ${weekendWorkouts}
    
    SUA PERSONALIDADE:
    - Você é extremamente motivador, mas rígido com a técnica.
    - Você usa emojis de academia (💪, 🔥, 🏋️, 🦍).
    - Você sabe tudo sobre execução de exercícios, divisão de treinos, suplementação e dieta.
    - Se o usuário perguntar algo fora do contexto fitness (ex: política, matemática), responda com humor dizendo que isso não faz o músculo crescer e volte para o treino.
    - Você fala de forma direta, usando gírias do meio maromba (shape, frango, anabólico, catabolizar, treino fofo).
    
    OBJETIVO:
    - Tirar dúvidas do usuário.
    - Corrigir mitos.
    - Montar exemplos rápidos de treino se pedido.
    - Motivar a ir treinar AGORA.
  `;

  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: systemInstruction,
    }
  });
};

export const generateAvatarImage = async (prompt: string): Promise<string | null> => {
  try {
    const ai = getAiClient();
    
    const refinedPrompt = `Avatar style, centered, round framing, high quality, vibrant colors, 3d render style: ${prompt}`;

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

export const analyzeWorkoutImage = async (base64Image: string): Promise<string> => {
    try {
        const ai = getAiClient();
        // Remove data:image/jpeg;base64, prefix if present
        const cleanBase64 = base64Image.split(',')[1] || base64Image;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: 'image/jpeg',
                            data: cleanBase64
                        }
                    },
                    {
                        text: "Descreva o treino em 3 palavras. Adicione 2 hashtags."
                    }
                ]
            }
        });

        return response.text || "Treino pesado! #Foco";
    } catch (error) {
        // Silently fail or log, don't break the user flow
        return "";
    }
}
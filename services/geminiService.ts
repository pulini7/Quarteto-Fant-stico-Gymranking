import { GoogleGenAI } from "@google/genai";
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

export const getCoachMessage = async (user: User): Promise<string> => {
  try {
    const ai = getAiClient();
    
    // Check if user has weekend workouts
    const weekendWorkouts = user.checkIns.filter(c => {
        const d = new Date(`${c.date}T12:00:00`);
        const day = d.getDay();
        return day === 0 || day === 6;
    }).length;

    // Aleatoriedade para simular um banco de dados gigante
    const randomTopic = COACH_TOPICS[Math.floor(Math.random() * COACH_TOPICS.length)];
    const tipNumber = Math.floor(Math.random() * 100) + 1; // Dica #1 a #100

    const prompt = `
      Você é o "Sargento Músculo", um treinador de academia intenso, motivador, mas engraçado e carismático.
      O usuário se chama ${user.name} e faz parte do "Quarteto Fantástico".
      
      Estatísticas do Aluno:
      - Total Treinos: ${user.checkIns.length}
      - Streak Atual: ${user.streak} dias
      - Treinos Fim de Semana: ${weekendWorkouts}
      
      SUA MISSÃO AGORA:
      Acesse seu "Manual Secreto de 100 Regras" e forneça a **Dica #${tipNumber}**.
      O tema desta dica específica deve ser sobre: **${randomTopic}**.
      
      Regras de Resposta:
      - Responda em Português do Brasil.
      - **Obrigatório começar a frase com: "Dica #${tipNumber}:"**
      - Seja direto (máximo 2 frases curtas).
      - Use gírias de maromba (shape, frango, monstro, meter o shape, fofo).
      - Se ela tiver treinos no fim de semana (${weekendWorkouts} > 0), elogie a constância no final.
      - Se o streak for baixo (< 3), mande ela largar o celular e agachar.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 1.2, // Alta criatividade para variar as frases
      }
    });

    return response.text || `Dica #${tipNumber}: Sem falatório, mais agachamento! Vá treinar!`;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "O treinador está comendo batata doce agora. Tente pedir a dica novamente em alguns segundos.";
  }
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
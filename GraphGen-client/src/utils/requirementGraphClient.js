import api from './api';

const DIAGRAM_TYPE_TO_CATEGORY = {
  'UML Diagram': 'UML',
  UML: 'UML',
  DFA: 'AUTOMATA',
  NFA: 'AUTOMATA',
  Automata: 'AUTOMATA',
  Flowchart: 'FLOWCHART',
  'ER Diagram': 'ER',
  ER: 'ER',
  'Data Structure': 'DATA_STRUCTURE',
  DS: 'DATA_STRUCTURE',
};

export async function generateRequirementGraph({ prompt, diagramType, category }) {
  const safePrompt = typeof prompt === 'string' ? prompt.trim() : '';
  if (!safePrompt) {
    throw new Error('Requirement text is required.');
  }

  const resolvedCategory =
    category ||
    DIAGRAM_TYPE_TO_CATEGORY[diagramType] ||
    'GENERAL';

  const response = await api.post('/api/requirement-graph/generate', {
    requirement: safePrompt,
    context: `Diagram type: ${diagramType || 'General'}\nPrompt: ${safePrompt}`,
    category: resolvedCategory,
  });

  return response?.data || null;
}

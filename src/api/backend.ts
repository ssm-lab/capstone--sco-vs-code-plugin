const BASE_URL = "http://127.0.0.1:8000"; // API URL for Python backend


// Fetch detected smells for a given file
export async function fetchSmells(filePath: string): Promise<Smell[]> {
  const url = `${BASE_URL}/smells?file_path=${encodeURIComponent(filePath)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error fetching smells: ${response.statusText}`);
    }
    const smellsList =  await response.json();
    return smellsList as Smell[];
  } catch (error) {
    console.error("Error in getSmells:", error);
    throw error;
  }
}

// Request refactoring for a specific smell
export async function refactorSmell(filePath: string, smell: Smell): Promise<{
  refactoredCode: string;
  energyDifference: number;
  updatedSmells: Smell[];
}> {
  const url = `${BASE_URL}/refactor`;
  const payload = {
    file_path: filePath,
    smell: smell,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Error refactoring smell: ${response.statusText}`);
    }

    const refactorResult = await response.json();
    return refactorResult as {
        refactoredCode: string;
        energyDifference: number;
        updatedSmells: Smell[];
      };
  } catch (error) {
    console.error("Error in refactorSmell:", error);
    throw error;
  }
}

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MindEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    #[serde(rename = "type")]
    pub edge_type: String,
    pub label: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RequirementNode {
    pub id: String,
    pub title: String,
    #[serde(rename = "docPath")]
    pub doc_path: String,
    pub status: String,
    pub priority: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub collapsed: bool,
    #[serde(default)]
    pub children: Vec<RequirementNode>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RequirementTree {
    pub version: String,
    #[serde(rename = "projectName")]
    pub project_name: String,
    pub root: RequirementNode,
    #[serde(default)]
    pub edges: Vec<MindEdge>,
}

impl RequirementNode {
    pub fn find_by_id(&self, id: &str) -> Option<&RequirementNode> {
        if self.id == id {
            return Some(self);
        }
        self.children.iter().find_map(|child| child.find_by_id(id))
    }

    pub fn find_by_id_mut(&mut self, id: &str) -> Option<&mut RequirementNode> {
        if self.id == id {
            return Some(self);
        }
        self.children.iter_mut().find_map(|child| child.find_by_id_mut(id))
    }

    pub fn add_child(&mut self, parent_id: &str, child: RequirementNode) -> bool {
        if self.id == parent_id {
            self.children.push(child);
            return true;
        }
        self.children.iter_mut().any(|c| c.add_child(parent_id, child.clone()))
    }

    pub fn collect_doc_paths(&self, paths: &mut Vec<String>) {
        if !self.doc_path.is_empty() {
            paths.push(self.doc_path.clone());
        }
        for child in &self.children {
            child.collect_doc_paths(paths);
        }
    }
}

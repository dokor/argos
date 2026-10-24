import { localizedMetadata } from "@/lib/i18n/metadata";
import { topics, text, type Topic } from "./content";
import type { Lang } from "@/lib/i18n/routes";
export const isTopic=(topic:string):topic is Topic=>Object.hasOwn(topics,topic)&&topic!=="start";
export function docsMetadata(topic:Topic,lang:Lang){
  const path="/docs"+(topic==="start"?"":"/"+topic);
  return {...localizedMetadata(path,lang,text(topics[topic],lang)+" · "+(lang==="fr"?"Documentation développeur":"Developer documentation"),
    lang==="fr"?"Guides publics de l’API CI Premium Argos : installation, clés obligatoires, modèles GitHub/GitLab, erreurs et reprise sûre. Accès CI en aperçu désactivé.":"Public Argos Premium CI API guides: setup, required API keys, GitHub/GitLab templates, errors and safe recovery. Preview CI access disabled."),
    robots:{index:true,follow:true}};
}

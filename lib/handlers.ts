import { get_context } from "./handlers/get_context";
import { list_projects } from "./handlers/list_projects";
import { create_project } from "./handlers/create_project";
import { update_project } from "./handlers/update_project";
import { delete_project } from "./handlers/delete_project";
import { search_issues } from "./handlers/search_issues";
import { get_issue } from "./handlers/get_issue";
import { create_issue } from "./handlers/create_issue";
import { delete_issue } from "./handlers/delete_issue";
import { update_issue } from "./handlers/update_issue";
import { add_worklog } from "./handlers/add_worklog";
import { get_workspace } from "./handlers/get_workspace";
import { get_project } from "./handlers/get_project";
import { get_configuration } from "./handlers/get_configuration";
import { list_worklogs } from "./handlers/list_worklogs";
import { update_worklog } from "./handlers/update_worklog";
import { log_work } from "./handlers/log_work";
import { list_configuration } from "./handlers/list_configuration";
import { create_configuration } from "./handlers/create_configuration";
import { update_configuration } from "./handlers/update_configuration";
import { export_data } from "./handlers/export_data";
export const handlers = {
  get_context,
  list_projects,
  create_project,
  update_project,
  delete_project,
  search_issues,
  get_issue,
  create_issue,
  delete_issue,
  update_issue,
  add_worklog,
  get_workspace,
  get_project,
  get_configuration,
  list_worklogs,
  update_worklog,
  delete_worklog: update_worklog,
  log_work,
  list_configuration,
  create_configuration,
  update_configuration,
  get_configuration_history: update_configuration,
  export_data,
};

import { contract, notificationContract } from "@hediet/typed-json-rpc";
import { array, type, string, literal, union } from "io-ts";

export const stepsContract = contract({
	server: {
		updateState: notificationContract({
			params: type({
				newState: array(
					type({
						id: string,
						state: union([
							literal("notRun"),
							literal("running"),
							literal("ran"),
							literal("undoing"),
							literal("undone"),
						]),
					})
				),
			}),
		}),
	},
	client: {},
});

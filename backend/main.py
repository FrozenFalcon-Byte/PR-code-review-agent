import argparse
import sys
from dotenv import load_dotenv
import agent
import renderer

load_dotenv()


def main():
    parser = argparse.ArgumentParser(
        description="Autonomous code review agent for GitHub pull requests."
    )
    parser.add_argument("pr_url", help="GitHub PR URL (e.g. https://github.com/owner/repo/pull/123)")
    parser.add_argument("--json", action="store_true", help="Output raw JSON instead of formatted review")
    parser.add_argument("--max-iter", type=int, default=10, metavar="N", help="Max agent iterations (default: 10)")
    args = parser.parse_args()

    try:
        review = agent.run(args.pr_url, max_iterations=args.max_iter)
        renderer.render(review, as_json=args.json)
    except KeyboardInterrupt:
        print("\nAborted.")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
